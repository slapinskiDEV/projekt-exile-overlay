import { contextBridge, ipcRenderer } from 'electron';
import { OVERLAY_API_METHODS, type OverlayBridge, type OverlayEventName } from '@shared/ipc';

/**
 * Most między interfejsem a procesem głównym. Interfejs nie ma dostępu do Node ani
 * do tokenu — tylko do metod z `OverlayApi`.
 */
const bridge: Record<string, unknown> = {};
for (const method of OVERLAY_API_METHODS) {
  bridge[method] = (...args: unknown[]) => ipcRenderer.invoke(`pe:${method}`, ...args);
}

bridge.on = (event: OverlayEventName, listener: (payload: unknown) => void) => {
  const handler = (_e: Electron.IpcRendererEvent, name: OverlayEventName, payload: unknown) => {
    if (name === event) listener(payload);
  };
  ipcRenderer.on('pe:event', handler);
  return () => ipcRenderer.removeListener('pe:event', handler);
};

contextBridge.exposeInMainWorld('overlay', bridge as unknown as OverlayBridge);
