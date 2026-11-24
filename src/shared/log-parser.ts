/**
 * Parser pliku `Client.txt` gry (czyste funkcje, bez Node i Electrona).
 *
 * Overlay czyta z logu tylko trzy rzeczy: nazwę obszaru, jego poziom i podpowiedź
 * nicku (najczęstszy autor wiadomości na czacie lokalnym). Linia logu wygląda tak:
 *
 *   2026/11/20 19:02:11 123456789 cff94598 [INFO Client 1234] : You have entered Clearfell.
 *
 * Wzorce są w tablicach poniżej — nowy wariant (np. inny język klienta) dopisuje się
 * jednym wpisem, bez zmiany reszty kodu.
 */

export type LogEvent =
  | { type: 'areaLevel'; level: number; areaCode: string | null }
  | { type: 'areaEntered'; name: string }
  | { type: 'chat'; speaker: string; message: string };

/** Prefiks linii: data, czas, licznik, id, `[POZIOM Client PID]`. Treść w grupie 1. */
const LINE_PREFIX =
  /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?: \d+)?(?: [0-9a-f]+)? \[(?:[A-Z]+) Client \d+\] ?(.*)$/;

/**
 * „Generating level 45 area "G2_1" with seed 123” — w logu poziomu DEBUG albo INFO,
 * zawsze tuż przed wejściem do obszaru.
 */
export const AREA_LEVEL_PATTERNS: RegExp[] = [
  /^Generating level (\d{1,3}) area "([^"]*)"/i,
  // Wariant bez cudzysłowów (spotykany w starszych wersjach klienta).
  /^Generating level (\d{1,3}) area (\S+)/i,
];

/**
 * Wejście do obszaru. Grupa 1 = nazwa obszaru.
 *
 * - Angielski: „: You have entered Clearfell.”
 * - PoE 2 loguje też zmianę sceny: „[SCENE] Set Source [Clearfell]”.
 * - Polski klient — **przypuszczenia**, niezweryfikowane na prawdziwym logu.
 *   Gdy ktoś przyśle prawdziwą linię, poprawić tutaj i dopisać test.
 */
export const AREA_ENTERED_PATTERNS: RegExp[] = [
  /^: You have entered (.+?)\.?$/,
  /^\[SCENE\] Set Source \[(.+)\]$/,
  /^: Wkroczono do (.+?)\.?$/, // przypuszczenie
  /^: Wszedłeś do (.+?)\.?$/, // przypuszczenie
  /^: Weszłaś do (.+?)\.?$/, // przypuszczenie
  /^: Wchodzisz do (.+?)\.?$/, // przypuszczenie
];

/** Nazwy scen, które nie są obszarem (ekran ładowania, menu). */
const IGNORED_AREA_NAMES = new Set(['(null)', '(unknown)', 'null', '']);

/**
 * Czat lokalny: „Nick: wiadomość” bez prefiksu kanału. Inne kanały zaczynają się od
 * `#` (globalny), `$` (handel), `%` (drużyna), `&` (gildia), `@` (szepty). Przed
 * nickiem może stać tag gildii w `<…>`. Nick w PoE nie ma spacji.
 */
const LOCAL_CHAT = /^(?:<[^>]{1,12}> )?([\p{L}\p{N}_]{3,32}): (.+)$/u;

/** Zwraca treść linii bez prefiksu daty i klienta albo `null`, gdy to nie linia gry. */
export function stripLinePrefix(line: string): string | null {
  const match = LINE_PREFIX.exec(line.replace(/\r$/, ''));
  return match ? (match[1] ?? '') : null;
}

export function parseLogLine(line: string): LogEvent | null {
  const body = stripLinePrefix(line);
  if (body === null) return null;

  for (const pattern of AREA_LEVEL_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      const level = Number.parseInt(match[1] ?? '', 10);
      if (!Number.isInteger(level) || level < 1 || level > 100) return null;
      return { type: 'areaLevel', level, areaCode: match[2] ?? null };
    }
  }

  for (const pattern of AREA_ENTERED_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      const name = (match[1] ?? '').trim();
      if (IGNORED_AREA_NAMES.has(name.toLowerCase())) return null;
      return { type: 'areaEntered', name };
    }
  }

  // Komunikaty systemowe zaczynają się od „: ”, kanały od znaku kanału.
  if (body.startsWith(':') || /^[#$%&@]/.test(body)) return null;
  const chat = LOCAL_CHAT.exec(body);
  if (chat) return { type: 'chat', speaker: chat[1]!, message: chat[2]! };

  return null;
}

export interface AreaInfo {
  name: string;
  level: number | null;
}

export interface LogState {
  area: AreaInfo | null;
  /** Poziom z ostatniej linii „Generating level”, czekający na wejście do obszaru. */
  pendingLevel: number | null;
  /** Ostatni autorzy wiadomości na czacie lokalnym (najnowsi na końcu). */
  recentSpeakers: string[];
}

export const INITIAL_LOG_STATE: LogState = {
  area: null,
  pendingLevel: null,
  recentSpeakers: [],
};

const MAX_SPEAKERS = 200;

export function applyLogEvent(state: LogState, event: LogEvent): LogState {
  switch (event.type) {
    case 'areaLevel':
      return { ...state, pendingLevel: event.level };
    case 'areaEntered': {
      // „Set Source” i „You have entered” potrafią przyjść oba dla tego samego
      // obszaru — drugi nie może skasować poziomu.
      if (state.pendingLevel === null && state.area?.name === event.name) return state;
      return {
        ...state,
        area: { name: event.name, level: state.pendingLevel },
        pendingLevel: null,
      };
    }
    case 'chat': {
      const recentSpeakers = [...state.recentSpeakers, event.speaker];
      if (recentSpeakers.length > MAX_SPEAKERS) recentSpeakers.splice(0, recentSpeakers.length - MAX_SPEAKERS);
      return { ...state, recentSpeakers };
    }
  }
}

export function applyLogLines(state: LogState, lines: string[]): LogState {
  let next = state;
  for (const line of lines) {
    const event = parseLogLine(line);
    if (event) next = applyLogEvent(next, event);
  }
  return next;
}

/**
 * Podpowiedź nicku: najczęstszy autor na czacie lokalnym. Gracz zwykle pisze sam do
 * siebie częściej niż ktokolwiek inny w tej samej instancji — to tylko podpowiedź,
 * gracz ją potwierdza albo poprawia.
 */
export function suggestNick(speakers: string[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (const speaker of speakers) {
    const count = (counts.get(speaker) ?? 0) + 1;
    counts.set(speaker, count);
    // Przy remisie wygrywa ten, kto pisał później.
    if (count >= bestCount) {
      best = speaker;
      bestCount = count;
    }
  }
  return best;
}

/** Dzieli strumień tekstu na pełne linie; niepełny koniec zostaje w buforze. */
export function splitLines(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const text = buffer + chunk;
  const parts = text.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.map((line) => line.replace(/\r$/, '')).filter((line) => line.length > 0), rest };
}
