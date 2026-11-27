import { describe, expect, it } from 'vitest';
import { mergeSettings } from '@shared/settings';
import {
  DEFAULT_SHORTCUTS,
  acceleratorFromKeyEvent,
  normalizeAccelerator,
  validateAccelerator,
  validateShortcuts,
} from '@shared/shortcuts';

describe('shortcuts', () => {
  it('accepts the defaults', () => {
    expect(validateShortcuts(DEFAULT_SHORTCUTS)).toEqual({});
  });

  it('normalizes modifier order and case', () => {
    expect(normalizeAccelerator('shift+alt+h')).toBe('Alt+Shift+H');
    expect(normalizeAccelerator('Control + Alt + f5')).toBe('Ctrl+Alt+F5');
  });

  it('rejects bare letters, Shift+letter and Ctrl+C', () => {
    expect(validateAccelerator('H')).not.toBeNull();
    expect(validateAccelerator('Shift+H')).not.toBeNull();
    expect(validateAccelerator('Ctrl+C')).not.toBeNull();
    expect(validateAccelerator('F7')).toBeNull();
    expect(validateAccelerator('Alt')).not.toBeNull();
  });

  it('reports duplicates', () => {
    const errors = validateShortcuts({ togglePanel: 'Alt+H', requestHelp: 'alt+h', offerHelp: 'Alt+O', askItem: 'Alt+C' });
    expect(errors.requestHelp).toMatch(/Pokaż \/ ukryj panel/);
    expect(errors.togglePanel).toBeUndefined();
  });

  it('builds an accelerator from a key event', () => {
    expect(acceleratorFromKeyEvent({ key: 'h', code: 'KeyH', altKey: true, ctrlKey: false, shiftKey: false })).toBe('Alt+H');
    expect(acceleratorFromKeyEvent({ key: 'Alt', code: 'AltLeft', altKey: true, ctrlKey: false, shiftKey: false })).toBeNull();
    expect(acceleratorFromKeyEvent({ key: '1', code: 'Digit1', altKey: false, ctrlKey: true, shiftKey: true })).toBe('Ctrl+Shift+1');
  });
});

describe('skrót oferty (0.3.3)', () => {
  it('Alt+O domyślnie, a stare ustawienia bez niego dostają domyślny', () => {
    expect(DEFAULT_SHORTCUTS.offerHelp).toBe('Alt+O');
    const merged = mergeSettings({ shortcuts: { togglePanel: 'Alt+H', requestHelp: 'Alt+P', askItem: 'Alt+C' } });
    expect(merged.shortcuts.offerHelp).toBe('Alt+O');
    expect(validateShortcuts(merged.shortcuts)).toEqual({});
  });
});
