import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LogWatcher } from '../main/log-watcher';

const line = (body: string) => `2026/11/20 19:02:31 98270100 b5f5e9d6 [INFO Client 8812] ${body}\r\n`;

describe('LogWatcher', () => {
  it('reads the tail on start, follows appends and handles truncation', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pe-log-')), 'Client.txt');
    writeFileSync(file, 'x'.repeat(5000) + '\n' + line('Generating level 3 area "G1_2" with seed 1') + line(': You have entered Clearfell.'));

    const watcher = new LogWatcher(file, { tailBytes: 300 });
    await watcher.poll();
    expect(watcher.snapshot().area).toEqual({ name: 'Clearfell', level: 3 });

    appendFileSync(file, line('Generating level 7 area "G1_4" with seed 2') + line(': You have entered The Grelwood'));
    appendFileSync(file, '.\r\n');
    await watcher.poll();
    expect(watcher.snapshot().area).toEqual({ name: 'The Grelwood', level: 7 });

    writeFileSync(file, line('Generating level 9 area "G1_5" with seed 3') + line('[SCENE] Set Source [Red Vale]'));
    await watcher.poll();
    expect(watcher.snapshot().area).toEqual({ name: 'Red Vale', level: 9 });
  });

  it('reports a missing file', async () => {
    const watcher = new LogWatcher(join(tmpdir(), 'does-not-exist', 'Client.txt'));
    const statuses: string[] = [];
    watcher.on('status', (s) => statuses.push(s));
    await watcher.poll();
    expect(statuses).toEqual(['missing']);
  });
});
