import type { OverlayBridge } from '../shared/ipc';

declare global {
  interface Window {
    overlay: OverlayBridge;
  }
}

export {};
