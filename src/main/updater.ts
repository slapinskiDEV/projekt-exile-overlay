import { app, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { diag } from './diag-log';
import { describeUpdateError } from './update-error';

/**
 * Aktualizacje z GitHub Releases (`latest.yml` z electron-builder). Przy starcie
 * sprawdzamy po cichu; gdy jest nowa wersja — pytanie „Zainstalować teraz?”.
 *
 * Każdy błąd trafia do dziennika diagnostycznego (0.2.1) — wcześniej znikał bez śladu
 * i nie dało się ustalić, czemu sprawdzanie nie działa. Przy ręcznym sprawdzaniu gracz
 * widzi powód i może pobrać instalator ze strony wydań.
 */
const RELEASES_URL = 'https://github.com/slapinskiDEV/projekt-exile-overlay/releases/latest';

let initialized = false;
let manualCheck = false;
let busy = false;
/** Etap, w którym wystąpił błąd — zdarzenie `error` przychodzi i przy sprawdzaniu, i przy pobieraniu. */
let phase: 'check' | 'download' = 'check';
/** Okienko błędu pokazujemy raz na próbę (`error` i odrzucona obietnica to ten sam błąd). */
let errorShown = false;

async function showUpdateError(error: unknown): Promise<void> {
  if (errorShown || !manualCheck) return;
  errorShown = true;
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Projekt Exile Overlay',
    message:
      phase === 'download'
        ? 'Nie udało się pobrać aktualizacji.'
        : 'Nie udało się sprawdzić aktualizacji.',
    detail: `${describeUpdateError(error)}\n\nNową wersję możesz też pobrać ręcznie i zainstalować na obecną — ustawienia zostaną.`,
    buttons: ['Pobierz ze strony', 'Zamknij'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) await shell.openExternal(RELEASES_URL);
}

function init() {
  if (initialized) return;
  initialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (message?: unknown) => diag('updater:info', String(message)),
    warn: (message?: unknown) => diag('updater:warn', String(message)),
    error: (message?: unknown) => diag('updater:error', String(message)),
    debug: () => undefined,
  };

  autoUpdater.on('update-available', async (info) => {
    diag('updater:available', { version: info.version });
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Projekt Exile Overlay',
      message: `Dostępna nowa wersja ${info.version}. Zainstalować teraz?`,
      buttons: ['Zainstaluj', 'Później'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      phase = 'download';
      // Pobieranie jest zawsze na wyraźną prośbę gracza — błąd pokazujemy także po cichym starcie.
      manualCheck = true;
      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        busy = false;
        await showUpdateError(error);
      }
    } else {
      busy = false;
    }
  });

  autoUpdater.on('update-not-available', () => {
    busy = false;
    if (manualCheck) {
      void dialog.showMessageBox({ type: 'info', title: 'Projekt Exile Overlay', message: 'Masz najnowszą wersję.' });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    diag('updater:downloaded');
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (error) => {
    busy = false;
    diag('updater:failed', { phase, message: error?.message?.slice(0, 1_000) });
    void showUpdateError(error);
  });
}

export async function checkForUpdates(manual: boolean): Promise<void> {
  if (!app.isPackaged) {
    if (manual) {
      void dialog.showMessageBox({ type: 'info', message: 'Aktualizacje działają tylko w zainstalowanej wersji.' });
    }
    return;
  }
  init();
  if (busy) return;
  busy = true;
  manualCheck = manual;
  phase = 'check';
  errorShown = false;
  diag('updater:check', { manual, current: app.getVersion() });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    busy = false;
    await showUpdateError(error);
  }
}
