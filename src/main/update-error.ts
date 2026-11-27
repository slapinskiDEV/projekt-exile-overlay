/** Czytelny powód błędu aktualizacji dla gracza (0.2.1) — bez stosu i adresów. */
export function describeUpdateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_/i.test(raw)) {
    return 'Brak połączenia z GitHubem — sprawdź internet, zaporę albo program antywirusowy.';
  }
  if (/sha512 checksum mismatch/i.test(raw)) {
    return 'Pobrany plik jest uszkodzony — spróbuj ponownie.';
  }
  if (/EPERM|EACCES|EBUSY/i.test(raw)) {
    return 'Brak dostępu do pliku aktualizacji — antywirus mógł go zablokować.';
  }
  if (/app-update\.yml/i.test(raw)) {
    return 'Brak pliku konfiguracji aktualizacji — zainstaluj overlay ponownie z instalatora.';
  }
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  return firstLine.slice(0, 200) || 'Nieznany błąd.';
}
