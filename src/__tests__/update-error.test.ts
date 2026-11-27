import { describe, expect, it } from 'vitest';
import { describeUpdateError } from '../main/update-error';

describe('describeUpdateError', () => {
  it('brak sieci → podpowiedź o internecie i zaporze', () => {
    expect(describeUpdateError(new Error('getaddrinfo ENOTFOUND github.com'))).toMatch(/połączenia/);
    expect(describeUpdateError(new Error('net::ERR_CONNECTION_RESET'))).toMatch(/połączenia/);
  });

  it('uszkodzony plik, blokada antywirusa, brak konfiguracji', () => {
    expect(describeUpdateError(new Error('sha512 checksum mismatch, expected x'))).toMatch(/uszkodzony/);
    expect(describeUpdateError(new Error('EPERM: operation not permitted'))).toMatch(/antywirus/);
    expect(describeUpdateError(new Error('ENOENT: app-update.yml'))).toMatch(/ponownie/);
  });

  it('inny błąd → pierwsza linia, bez stosu', () => {
    expect(describeUpdateError(new Error('Coś dziwnego\n    at stack'))).toBe('Coś dziwnego');
    expect(describeUpdateError(undefined)).toBe('Nieznany błąd.');
  });
});
