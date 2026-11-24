import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, toPublicSettings } from '@shared/settings';
import { SettingsStore, type TokenCipher } from '../main/settings-store';

const reversing: TokenCipher = {
  available: () => true,
  encrypt: (plain) => Buffer.from([...plain].reverse().join('')).toString('base64'),
  decrypt: (enc) => [...Buffer.from(enc, 'base64').toString()].reverse().join(''),
};

describe('mergeSettings', () => {
  it('falls back to defaults for garbage', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ soundEnabled: 'yes', mode: 'admin', shortcuts: { askItem: 5 } })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps known values', () => {
    const merged = mergeSettings({ league: 'Dawn', soundEnabled: false, shortcuts: { togglePanel: 'Alt+J' } });
    expect(merged.league).toBe('Dawn');
    expect(merged.soundEnabled).toBe(false);
    expect(merged.shortcuts.togglePanel).toBe('Alt+J');
    expect(merged.shortcuts.askItem).toBe('Alt+C');
  });

  it('never exposes the token publicly', () => {
    const pub = toPublicSettings({ ...DEFAULT_SETTINGS, tokenPlain: 'pex_secret', tokenEncrypted: 'x' });
    expect(JSON.stringify(pub)).not.toContain('pex_secret');
    expect(pub).not.toHaveProperty('tokenEncrypted');
  });
});

describe('SettingsStore', () => {
  it('stores the token encrypted and reads it back', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pe-settings-')), 'settings.json');
    const store = new SettingsStore(file, reversing);
    store.setToken('pex_abc123');
    const disk = readFileSync(file, 'utf8');
    expect(disk).not.toContain('pex_abc123');
    expect(new SettingsStore(file, reversing).getToken()).toBe('pex_abc123');
    store.setToken(null);
    expect(new SettingsStore(file, reversing).getToken()).toBeNull();
  });

  it('falls back to plain text when encryption is unavailable', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pe-settings-')), 'settings.json');
    const store = new SettingsStore(file, { ...reversing, available: () => false });
    store.setToken('pex_plain');
    expect(store.get().tokenPlain).toBe('pex_plain');
    expect(store.getToken()).toBe('pex_plain');
  });

  it('survives a corrupted file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pe-settings-')), 'settings.json');
    writeFileSync(file, '{not json');
    expect(new SettingsStore(file, reversing).get()).toEqual(DEFAULT_SETTINGS);
  });
});
