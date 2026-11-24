import { join } from 'node:path';
import { app, BrowserWindow, screen, shell } from 'electron';

export type View = 'overlay' | 'setup' | 'settings';

function preloadPath() {
  return join(__dirname, '../preload/index.js');
}

export function iconPath(file = 'icon.png') {
  return !app.isPackaged
    ? join(__dirname, '../../resources', file)
    : join(process.resourcesPath, 'resources', file);
}

function load(win: BrowserWindow, view: View, query = '') {
  const hash = `${view}${query ? `?${query}` : ''}`;
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }
}

function hardenNavigation(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL);
    if (!allowed && !url.startsWith('file://')) event.preventDefault();
  });
}

const webPreferences = () => ({
  preload: preloadPath(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
  autoplayPolicy: 'no-user-gesture-required' as const,
});

/**
 * Przezroczyste okno nad grą (tryb okna bez ramki): całe główne okno ekranu, zawsze
 * na wierzchu, bez paska zadań. Domyślnie przepuszcza kliknięcia do gry; łapie je
 * tylko, gdy kursor jest nad panelem albo okienkiem powiadomienia.
 */
export function createOverlayWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    title: 'Projekt Exile Overlay',
    webPreferences: webPreferences(),
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setMenu(null);
  hardenNavigation(win);
  load(win, 'overlay');
  win.once('ready-to-show', () => win.showInactive());
  return win;
}

/** Zwykłe okno kreatora i ustawień. */
export function createMainWindow(view: 'setup' | 'settings', query = ''): BrowserWindow {
  const win = new BrowserWindow({
    width: 620,
    height: 780,
    minWidth: 520,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0b0b',
    autoHideMenuBar: true,
    title: 'Projekt Exile Overlay',
    icon: iconPath(),
    webPreferences: webPreferences(),
  });
  win.setMenu(null);
  hardenNavigation(win);
  load(win, view, query);
  win.once('ready-to-show', () => win.show());
  return win;
}

export function loadView(win: BrowserWindow, view: 'setup' | 'settings', query = '') {
  load(win, view, query);
}
