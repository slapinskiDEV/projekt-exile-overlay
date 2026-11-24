import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import {
  INITIAL_LOG_STATE,
  applyLogLines,
  splitLines,
  currentCharacter,
  type AreaInfo,
  type CharacterInfo,
  type LogState,
} from '@shared/log-parser';

/**
 * Śledzenie `Client.txt`: start od końca pliku, dopisywane linie co `intervalMs`,
 * obsługa obcięcia i podmiany pliku. Na starcie czytamy ostatnie `tailBytes`, żeby
 * od razu znać bieżący obszar i podpowiedź nicku.
 *
 * Plik jest otwierany tylko do odczytu, na chwilę — gra może go swobodnie zapisywać.
 */

export interface LogSnapshot {
  area: AreaInfo | null;
  nickHint: string | null;
  character: CharacterInfo | null;
}

export interface LogWatcherOptions {
  intervalMs?: number;
  tailBytes?: number;
  /** Ile bajtów maksymalnie przeczytać w jednym kroku. */
  maxChunk?: number;
}

export class LogWatcher extends EventEmitter<{
  change: [LogSnapshot];
  status: ['watching' | 'missing'];
}> {
  private state: LogState = INITIAL_LOG_STATE;
  private position = 0;
  private identity: string | null = null;
  private rest = '';
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private started = false;
  private status: 'watching' | 'missing' | null = null;
  private readonly intervalMs: number;
  private readonly tailBytes: number;
  private readonly maxChunk: number;

  constructor(
    private readonly path: string,
    options: LogWatcherOptions = {},
  ) {
    super();
    this.intervalMs = options.intervalMs ?? 500;
    // 2 MB — żeby trafić na ostatni awans postaci, a nie tylko na bieżący obszar.
    this.tailBytes = options.tailBytes ?? 2 * 1024 * 1024;
    this.maxChunk = options.maxChunk ?? 1024 * 1024;
  }

  snapshot(): LogSnapshot {
    const character = currentCharacter(this.state.levelUps);
    return { area: this.state.area, nickHint: character?.name ?? null, character };
  }

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Jeden krok — publiczny dla testów. */
  async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.step();
    } finally {
      this.busy = false;
    }
  }

  private setStatus(status: 'watching' | 'missing') {
    if (this.status !== status) {
      this.status = status;
      this.emit('status', status);
    }
  }

  private async step(): Promise<void> {
    let stat;
    try {
      stat = await fs.stat(this.path);
    } catch {
      this.setStatus('missing');
      return;
    }
    this.setStatus('watching');

    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
    if (!this.started) {
      this.started = true;
      this.identity = identity;
      this.position = Math.max(0, stat.size - this.tailBytes);
      // Pierwsza linia po skoku w środek pliku jest niepełna — pomijamy ją.
      await this.read(stat.size, this.position > 0);
      return;
    }

    if (identity !== this.identity || stat.size < this.position) {
      // Nowy plik albo obcięty — czytamy od początku.
      this.identity = identity;
      this.position = 0;
      this.rest = '';
    }
    if (stat.size > this.position) await this.read(stat.size, false);
  }

  private async read(size: number, skipFirstLine: boolean): Promise<void> {
    const handle = await fs.open(this.path, 'r');
    try {
      const lines: string[] = [];
      let first = skipFirstLine;
      while (this.position < size) {
        const length = Math.min(this.maxChunk, size - this.position);
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, this.position);
        if (bytesRead <= 0) break;
        this.position += bytesRead;
        let text = buffer.subarray(0, bytesRead).toString('utf8');
        if (first) {
          const newline = text.indexOf('\n');
          text = newline === -1 ? '' : text.slice(newline + 1);
          first = false;
        }
        const split = splitLines(this.rest, text);
        this.rest = split.rest;
        lines.push(...split.lines);
      }
      if (lines.length === 0) return;
      const before = this.snapshot();
      this.state = applyLogLines(this.state, lines);
      const after = this.snapshot();
      if (
        before.nickHint !== after.nickHint ||
        before.character?.level !== after.character?.level ||
        before.area?.name !== after.area?.name ||
        before.area?.level !== after.area?.level
      ) {
        this.emit('change', after);
      }
    } finally {
      await handle.close();
    }
  }
}
