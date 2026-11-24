import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Aktualizacje z GitHub Releases (`latest.yml` z electron-builder). Przy starcie
 * sprawdzamy po cichu; gdy jest nowa wersja — pytanie „Zainstalować teraz?”.
 */
let initialized = false;
let manualCheck = false;
let busy = false;

function init() {
  if (initialized) return;
  initialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Projekt Exile Overlay',
      message: `Dostępna nowa wersja ${info.version}. Zainstalować teraz?`,
      buttons: ['Zainstaluj', 'Później'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch {
        busy = false;
        void dialog.showMessageBox({ type: 'error', message: 'Nie udało się pobrać aktualizacji. Spróbuj później.' });
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
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', () => {
    busy = false;
    if (manualCheck) {
      void dialog.showMessageBox({ type: 'error', message: 'Nie udało się sprawdzić aktualizacji.' });
    }
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
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    busy = false;
  }
}
