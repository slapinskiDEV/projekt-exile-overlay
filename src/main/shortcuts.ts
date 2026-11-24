import { globalShortcut } from 'electron';
import { diag } from './diag-log';
import { normalizeAccelerator, type ShortcutAction, type ShortcutMap } from '@shared/shortcuts';

/**
 * Globalne skróty. Każde naciśnięcie wywołuje akcję co najwyżej raz: przytrzymany
 * klawisz (autopowtarzanie systemu) nie wywoła jej ponownie przed upływem `cooldownMs`.
 */
export class ShortcutManager {
  private map: ShortcutMap | null = null;
  private suspended = false;
  private last = new Map<ShortcutAction, number>();

  constructor(
    private readonly handlers: Record<ShortcutAction, () => void>,
    private readonly cooldownMs = 400,
  ) {}

  /** Rejestruje skróty; zwraca te, których system nie pozwolił zarejestrować. */
  apply(map: ShortcutMap): Partial<Record<ShortcutAction, string>> {
    this.map = map;
    if (this.suspended) return {};
    globalShortcut.unregisterAll();
    const errors: Partial<Record<ShortcutAction, string>> = {};
    for (const action of Object.keys(map) as ShortcutAction[]) {
      const accelerator = normalizeAccelerator(map[action]);
      let ok = false;
      try {
        ok = globalShortcut.register(accelerator, () => this.fire(action));
      } catch {
        ok = false;
      }
      if (!ok) errors[action] = 'Skrót jest zajęty przez inną aplikację albo system.';
    }
    return errors;
  }

  private fire(action: ShortcutAction) {
    const now = Date.now();
    if (now - (this.last.get(action) ?? 0) < this.cooldownMs) return;
    diag('shortcut', { action });
    this.last.set(action, now);
    this.handlers[action]();
  }

  /** Na czas nagrywania skrótu w ustawieniach. */
  suspend(suspended: boolean): Partial<Record<ShortcutAction, string>> {
    this.suspended = suspended;
    if (suspended) {
      globalShortcut.unregisterAll();
      return {};
    }
    return this.map ? this.apply(this.map) : {};
  }

  dispose() {
    globalShortcut.unregisterAll();
  }
}
