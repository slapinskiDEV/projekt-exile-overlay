import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Dziennik diagnostyczny (0.1.3): skróty, pokazanie panelu, monitory i błędy okna
 * nakładki. Bez treści próśb, tokenów ani schowka — gracz może go spokojnie wysłać.
 * Plik ma najwyżej ~1 MB; starszy trafia do `.old`.
 */
const MAX_BYTES = 1_000_000;

let file: string | null = null;

export function initDiagLog(path: string): void {
  file = path;
  try {
    mkdirSync(dirname(path), { recursive: true });
    if (statSync(path).size > MAX_BYTES) renameSync(path, `${path}.old`);
  } catch {
    // brak pliku — powstanie przy pierwszym wpisie
  }
}

export function diagLogPath(): string | null {
  return file;
}

export function diag(message: string, data?: unknown): void {
  const line = `${new Date().toISOString()} ${message}${data === undefined ? '' : ` ${safeJson(data)}`}\n`;
  if (process.env.ELECTRON_RENDERER_URL) process.stdout.write(line);
  if (!file) return;
  try {
    appendFileSync(file, line, 'utf8');
  } catch {
    // dziennik nie może wywrócić aplikacji
  }
}

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data).slice(0, 2_000);
  } catch {
    return String(data);
  }
}
