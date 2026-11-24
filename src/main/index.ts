import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  screen,
  shell,
  Tray,
} from 'electron';
import { parseItemText } from '@shared/poe-item';
import { isBelowMinVersion } from '@shared/version';
import { SHORTCUT_LABELS, validateShortcuts, type ShortcutAction } from '@shared/shortcuts';
import { toPublicSettings, type PublicSettings } from '@shared/settings';
import {
  OVERLAY_API_METHODS,
  type ApiResult,
  type AppState,
  type OverlayApi,
  type OverlayEventName,
  type OverlayEvents,
  type PanelCommand,
} from '@shared/ipc';
import { createApiClient, DEFAULT_API_URL } from './api';
import { detectClientTxt } from './client-path';
import { copyItemFromGame, createKeySender, PowerShellKeySender } from './key-sender';
import { LogWatcher } from './log-watcher';
import { NotificationPoller } from './notifications';
import { RealtimeNotifications } from './realtime';
import { SettingsStore } from './settings-store';
import { ShortcutManager } from './shortcuts';
import { checkForUpdates } from './updater';
import { diag, diagLogPath, initDiagLog } from './diag-log';
import { createMainWindow, createOverlayWindow, iconPath, loadView } from './windows';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('pl.projektexile.overlay');
  void app.whenReady().then(start);
}

const VERSION = app.getVersion();
const API_URL = process.env.PE_API_URL || DEFAULT_API_URL;

let store: SettingsStore;
let overlay: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let watcher: LogWatcher | null = null;
let shortcuts: ShortcutManager;
let poller: NotificationPoller | null = null;
let realtime: RealtimeNotifications | null = null;
const keySender = createKeySender();

const runtime: Omit<AppState, 'version' | 'settings' | 'paired'> = {
  area: null,
  nickHint: null,
  character: null,
  updateRequired: null,
  panelVisible: false,
  log: { status: 'idle', path: null },
  shortcutErrors: {},
};

const api = createApiClient({
  baseUrl: API_URL,
  version: VERSION,
  getToken: () => store.getToken(),
  onUpdateRequired: (minVersion) => {
    if (!runtime.updateRequired) {
      runtime.updateRequired = { minVersion };
      broadcastState();
    }
  },
  onRevoked: () => handleRevoked(),
});

// --- stan i zdarzenia --------------------------------------------------------------

function state(): AppState {
  return {
    ...runtime,
    version: VERSION,
    settings: toPublicSettings(store.get()),
    paired: store.get().mode === 'paired' && store.getToken() !== null,
  };
}

function send<E extends OverlayEventName>(win: BrowserWindow | null, event: E, payload: OverlayEvents[E]) {
  if (win && !win.isDestroyed()) win.webContents.send('pe:event', event, payload);
}

function broadcastState() {
  const s = state();
  send(overlay, 'state', s);
  send(mainWindow, 'state', s);
}

// --- okna ---------------------------------------------------------------------------

function openMainWindow(view: 'setup' | 'settings', query = '') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadView(mainWindow, view, query);
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = createMainWindow(view, query);
  mainWindow.on('closed', () => {
    mainWindow = null;
    shortcuts?.suspend(false);
  });
}

function setPanelVisible(visible: boolean) {
  if (!overlay || overlay.isDestroyed()) return;
  runtime.panelVisible = visible;
  if (visible) {
    // Kliknięcia poza panelem dalej trafiają do gry — okno łapie je tylko nad
    // panelem (setInteractive z interfejsu). Bez focus(): zabranie aktywności grze
    // działało jak Alt+Tab (gra w pełnym ekranie się zwijała). Klawiaturę panel
    // dostaje dopiero, gdy gracz w niego kliknie.
    overlay.setFocusable(true);
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.showInactive();
    overlay.moveTop();
    diag('panel:show', {
      bounds: overlay.getBounds(),
      visible: overlay.isVisible(),
      cursorDisplay: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id,
      primaryDisplay: screen.getPrimaryDisplay().id,
    });
  } else {
    overlay.setIgnoreMouseEvents(true, { forward: true });
    overlay.blur();
    overlay.setFocusable(false);
    diag('panel:hide');
  }
  broadcastState();
}

function showPanel(command: PanelCommand) {
  setPanelVisible(true);
  send(overlay, 'panel', command);
}

// --- skróty ---------------------------------------------------------------------------

let copying = false;

const shortcutHandlers: Record<ShortcutAction, () => void> = {
  togglePanel: () => {
    if (!store.get().setupDone) return openMainWindow('setup');
    if (runtime.panelVisible) setPanelVisible(false);
    else showPanel({ kind: 'list' });
  },
  requestHelp: () => {
    if (!store.get().setupDone) return openMainWindow('setup');
    showPanel({ kind: 'request' });
  },
  askItem: () => void askItem(),
};

/**
 * Alt+C: jedno Ctrl+C do gry i jeden odczyt schowka (zasady GGG). Bez konta albo przy
 * nieobsługiwanej wersji nie wysyłamy niczego do gry — panel pokaże powód.
 */
async function askItem() {
  if (!store.get().setupDone) return openMainWindow('setup');
  if (copying) return;
  if (runtime.updateRequired || !state().paired) {
    showPanel({ kind: 'request', categoryId: 'crafting' });
    return;
  }
  copying = true;
  try {
    if (runtime.panelVisible) {
      // Ctrl+C musi trafić do gry, nie do panelu.
      setPanelVisible(false);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const text = await copyItemFromGame(keySender, () => clipboard.readText());
    if (parseItemText(text)) showPanel({ kind: 'request', categoryId: 'crafting', itemText: text });
    else showPanel({ kind: 'item-not-found' });
  } finally {
    copying = false;
  }
}

function applyShortcuts() {
  runtime.shortcutErrors = store.get().setupDone ? shortcuts.apply(store.get().shortcuts) : {};
  diag('shortcuts:apply', { shortcuts: store.get().shortcuts, errors: runtime.shortcutErrors });
}

/**
 * Skrót zajęty przez inną aplikację (np. CapCut bierze Alt+H) — bez tego gracz widzi
 * tylko, że nakładka „nie działa”. Mówimy wprost, który skrót i gdzie go zmienić.
 */
function warnAboutTakenShortcuts() {
  const taken = (Object.keys(runtime.shortcutErrors) as ShortcutAction[]).map(
    (action) => `${store.get().shortcuts[action]} (${SHORTCUT_LABELS[action]})`,
  );
  if (taken.length === 0 || !Notification.isSupported()) return;
  const notification = new Notification({
    title: 'Projekt Exile Overlay: skrót zajęty',
    body: `${taken.join(', ')} — używa go inna aplikacja. Kliknij, żeby ustawić inny skrót.`,
    icon: iconPath(),
  });
  notification.on('click', () => openMainWindow('settings'));
  notification.show();
}

// --- log -------------------------------------------------------------------------------

function startWatcher() {
  watcher?.stop();
  watcher?.removeAllListeners();
  watcher = null;
  const path = store.get().clientTxtPath;
  runtime.log = { status: 'idle', path };
  if (!path) return;
  watcher = new LogWatcher(path);
  watcher.on('change', (snapshot) => {
    runtime.area = snapshot.area;
    runtime.nickHint = snapshot.nickHint;
    runtime.character = snapshot.character;
    broadcastState();
  });
  watcher.on('status', (status) => {
    runtime.log = { status, path };
    broadcastState();
  });
  watcher.start();
}

// --- powiadomienia ----------------------------------------------------------------------

function startNotifications() {
  stopNotifications();
  if (!state().paired || runtime.updateRequired) return;
  poller = new NotificationPoller(api, (notification) => send(overlay, 'notification', notification));
  poller.start();
  realtime = new RealtimeNotifications(api, () => void poller?.poll());
  void realtime.start();
}

function stopNotifications() {
  poller?.reset();
  poller = null;
  void realtime?.stop();
  realtime = null;
}

function handleRevoked() {
  store.setToken(null);
  store.update({ mode: null, profile: null });
  stopNotifications();
  broadcastState();
  setPanelVisible(false);
  openMainWindow('setup', 'step=pair');
}

// --- IPC ----------------------------------------------------------------------------------

function str(value: unknown, max = 20_000): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function requireVersion<T = never>(): ApiResult<T> | null {
  if (!runtime.updateRequired) return null;
  return {
    ok: false,
    error: {
      status: 426,
      error: 'update_required',
      message: 'Zaktualizuj overlay — ta wersja nie jest już obsługiwana.',
      minVersion: runtime.updateRequired.minVersion,
    },
  };
}

const handlers: OverlayApi = {
  getState: async () => state(),

  updateSettings: async (patch) => {
    const allowed: Partial<PublicSettings> = {};
    if (patch && typeof patch === 'object') {
      if ('league' in patch) allowed.league = typeof patch.league === 'string' ? patch.league : null;
      if (typeof patch.nick === 'string') allowed.nick = patch.nick.trim().slice(0, 40);
      if ('clientTxtPath' in patch) allowed.clientTxtPath = typeof patch.clientTxtPath === 'string' ? patch.clientTxtPath : null;
      if (typeof patch.soundEnabled === 'boolean') allowed.soundEnabled = patch.soundEnabled;
    }
    const pathChanged = 'clientTxtPath' in allowed && allowed.clientTxtPath !== store.get().clientTxtPath;
    store.update(allowed);
    if (pathChanged && store.get().privacyAccepted) startWatcher();
    broadcastState();
    return state();
  },

  acceptPrivacy: async () => {
    store.update({ privacyAccepted: true });
    broadcastState();
    return state();
  },

  finishSetup: async () => {
    store.update({ setupDone: true, mode: store.get().mode ?? 'preview' });
    applyShortcuts();
    startWatcher();
    startNotifications();
    broadcastState();
    mainWindow?.close();
    return state();
  },

  setShortcuts: async (map) => {
    const errors = validateShortcuts(map);
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    store.update({ shortcuts: map });
    applyShortcuts();
    broadcastState();
    return { ok: Object.keys(runtime.shortcutErrors).length === 0, errors: runtime.shortcutErrors };
  },

  suspendShortcuts: async (suspended) => {
    const errors = shortcuts.suspend(Boolean(suspended));
    if (!suspended) {
      runtime.shortcutErrors = store.get().setupDone ? errors : {};
      broadcastState();
    }
  },

  detectClientTxt: async () => detectClientTxt(),

  chooseClientTxt: async () => {
    const parent = mainWindow ?? undefined;
    const options: Electron.OpenDialogOptions = {
      title: 'Wskaż plik Client.txt',
      properties: ['openFile'],
      filters: [{ name: 'Log gry (Client.txt)', extensions: ['txt'] }],
    };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  },

  pair: async (code) => {
    const blocked = requireVersion();
    if (blocked) return blocked;
    const result = await api.pair({
      code: str(code, 32).replace(/[\s-]/g, '').toUpperCase(),
      deviceName: 'Projekt Exile Overlay (Windows)',
    });
    if (result.ok) {
      store.setToken(result.data.token);
      store.update({ mode: 'paired', profile: result.data.user });
      if (store.get().setupDone) startNotifications();
      broadcastState();
      // Token nie wychodzi do interfejsu.
      return { ok: true, data: { token: '', user: result.data.user } };
    }
    return result;
  },

  usePreviewMode: async () => {
    store.update({ mode: 'preview', profile: null });
    store.setToken(null);
    broadcastState();
    return state();
  },

  disconnect: async () => {
    if (store.getToken()) await api.disconnect();
    store.setToken(null);
    store.update({ mode: 'preview', profile: null });
    stopNotifications();
    broadcastState();
    return state();
  },

  leagues: () => api.leagues(),
  categories: () => api.categories(),
  contracts: (query) =>
    api.contracts({
      league: typeof query?.league === 'string' ? query.league : null,
      category: typeof query?.category === 'string' ? query.category : null,
      area: typeof query?.area === 'string' ? query.area : null,
      areaLevel: typeof query?.areaLevel === 'number' ? query.areaLevel : null,
    }),
  contract: (id) => api.contract(str(id, 64)),
  createContract: async (body) =>
    requireVersion() ??
    api.createContract({
      categoryId: str(body?.categoryId, 64),
      text: str(body?.text, 500),
      league: typeof body?.league === 'string' ? body.league : null,
      area: typeof body?.area === 'string' && body.area.trim() ? body.area.trim().slice(0, 120) : null,
      areaLevel: typeof body?.areaLevel === 'number' && Number.isInteger(body.areaLevel) ? body.areaLevel : null,
      itemText: typeof body?.itemText === 'string' && body.itemText ? body.itemText.slice(0, 10_000) : null,
      contractType: body?.contractType === 'community' ? 'community' : 'individual',
    }),
  apply: async (id, message) => requireVersion() ?? api.apply(str(id, 64), message ? str(message, 1000) : undefined),
  sendMessage: async (id, content) => requireVersion() ?? api.sendMessage(str(id, 64), str(content, 2000)),
  extend: async (id) => requireVersion() ?? api.extend(str(id, 64)),
  close: async (id) => requireVersion() ?? api.close(str(id, 64)),
  finish: async (id, helperIds) =>
    requireVersion() ??
    api.finish(str(id, 64), { helperIds: Array.isArray(helperIds) ? helperIds.filter((h) => typeof h === 'string') : [] }),
  acceptApplication: async (id) => requireVersion() ?? api.acceptApplication(str(id, 64)),
  withdrawApplication: async (id) => requireVersion() ?? api.withdrawApplication(str(id, 64)),
  threads: (league) => api.threads(typeof league === 'string' ? league : null),
  thread: (id) => api.thread(str(id, 64)),
  createThread: async (body) =>
    requireVersion() ??
    api.createThread({
      title: str(body?.title, 200),
      content: str(body?.content, 10_000),
      league: typeof body?.league === 'string' ? body.league : null,
    }),
  replyToThread: async (id, content) => requireVersion() ?? api.replyToThread(str(id, 64), str(content, 10_000)),
  me: () => api.me(),

  setPanelVisible: async (visible) => setPanelVisible(Boolean(visible)),
  setInteractive: async (interactive) => {
    if (!overlay || overlay.isDestroyed()) return;
    if (interactive) overlay.setIgnoreMouseEvents(false);
    else overlay.setIgnoreMouseEvents(true, { forward: true });
  },
  openExternal: async (url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) await shell.openExternal(url);
  },
  openSettings: async () => openMainWindow(store.get().setupDone ? 'settings' : 'setup'),
  checkForUpdates: async () => checkForUpdates(true),
  copyText: async (text) => {
    await clipboard.writeText(str(text));
  },
};

function registerIpc() {
  for (const method of OVERLAY_API_METHODS) {
    ipcMain.handle(`pe:${method}`, (_event, ...args: unknown[]) =>
      (handlers[method] as (...a: unknown[]) => Promise<unknown>)(...args),
    );
  }
}

// --- zasobnik ----------------------------------------------------------------------------

/** Ręczne przeładowanie okna nakładki (menu zasobnika) — panel startuje od listy. */
function reloadOverlay() {
  if (!overlay || overlay.isDestroyed()) {
    overlay = createOverlayWindow();
    watchOverlayWindow(overlay);
    overlay.on('closed', () => {
      overlay = null;
    });
  } else {
    // „Wyczyść i zacznij od nowa”: cache okna i zapamiętana pozycja panelu.
    setPanelVisible(false);
    const win = overlay;
    void win.webContents
      .executeJavaScript("try { localStorage.removeItem('pe.panelPosition') } catch {}")
      .catch(() => undefined)
      .then(() => win.webContents.session.clearCache())
      .finally(() => {
        if (!win.isDestroyed()) win.webContents.reload();
      });
  }
  diag('overlay:reload');
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath('tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createFromPath(iconPath()) : image);
  tray.setToolTip('Projekt Exile Overlay');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Pokaż / ukryj panel', click: () => shortcutHandlers.togglePanel() },
      { label: 'Przeładuj nakładkę', click: () => reloadOverlay() },
      { label: 'Ustawienia', click: () => openMainWindow(store.get().setupDone ? 'settings' : 'setup') },
      { label: 'Sprawdź aktualizacje', click: () => void checkForUpdates(true) },
      {
        label: 'Otwórz dziennik diagnostyczny',
        click: () => {
          const path = diagLogPath();
          if (path) shell.showItemInFolder(path);
        },
      },
      { type: 'separator' },
      { label: 'Zamknij', click: () => app.quit() },
    ]),
  );
  tray.on('click', () => shortcutHandlers.togglePanel());
}

// --- start ------------------------------------------------------------------------------------

async function checkVersion() {
  const result = await api.version();
  if (result.ok && isBelowMinVersion(VERSION, result.data.minVersion)) {
    runtime.updateRequired = { minVersion: result.data.minVersion };
    stopNotifications();
    broadcastState();
  }
}

/** Błędy okna nakładki trafiają do dziennika; padnięte okno ładuje się od nowa. */
function watchOverlayWindow(win: BrowserWindow) {
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning' || event.message.startsWith('[pe]')) {
      diag(`renderer:${event.level}`, { message: event.message, source: event.sourceId, line: event.lineNumber });
    }
  });
  win.webContents.on('did-fail-load', (_e, code, description) => diag('renderer:fail-load', { code, description }));
  win.webContents.on('render-process-gone', (_e, details) => {
    diag('renderer:gone', details);
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) {
      runtime.panelVisible = false;
      win.reload();
    }
  });
  win.on('unresponsive', () => diag('renderer:unresponsive'));
}

async function start() {
  initDiagLog(join(app.getPath('userData'), 'overlay.log'));
  diag('start', {
    version: VERSION,
    platform: process.platform,
    displays: screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, scale: d.scaleFactor })),
    primary: screen.getPrimaryDisplay().id,
  });
  store = new SettingsStore(join(app.getPath('userData'), 'settings.json'), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encrypted) => safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
  });
  shortcuts = new ShortcutManager(shortcutHandlers);

  registerIpc();
  createTray();
  overlay = createOverlayWindow();
  watchOverlayWindow(overlay);
  overlay.on('closed', () => {
    overlay = null;
  });

  if (keySender instanceof PowerShellKeySender) keySender.warmUp();

  await checkVersion();

  if (store.get().setupDone) {
    applyShortcuts();
    warnAboutTakenShortcuts();
    startWatcher();
    startNotifications();
  } else {
    openMainWindow('setup');
  }
  broadcastState();

  void checkForUpdates(false);
}

app.on('second-instance', () => {
  if (store) openMainWindow(store.get().setupDone ? 'settings' : 'setup');
});

// Overlay żyje w zasobniku — zamknięcie okna ustawień nie kończy aplikacji.
app.on('window-all-closed', () => undefined);

app.on('will-quit', () => {
  shortcuts?.dispose();
  watcher?.stop();
  stopNotifications();
  keySender.dispose();
});
