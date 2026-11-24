import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_LOG_STATE,
  applyLogLines,
  currentCharacter,
  parseLogLine,
  splitLines,
  stripLinePrefix,
  suggestNick,
} from '@shared/log-parser';

const sample = readFileSync(join(__dirname, 'fixtures/client-sample.txt'), 'utf8').split('\n');

describe('parseLogLine', () => {
  it('reads the area level from DEBUG and INFO lines', () => {
    expect(
      parseLogLine('2026/11/20 19:02:30 98269112 cff94598 [DEBUG Client 8812] Generating level 45 area "G2_1" with seed 123'),
    ).toEqual({ type: 'areaLevel', level: 45, areaCode: 'G2_1' });
    expect(
      parseLogLine('2026/11/20 19:02:30 98269112 cff94598 [INFO Client 8812] Generating level 72 area "MapBluff" with seed 9'),
    ).toEqual({ type: 'areaLevel', level: 72, areaCode: 'MapBluff' });
  });

  it('reads the area name in English', () => {
    expect(parseLogLine('2026/11/20 19:02:31 98270100 b5f5e9d6 [INFO Client 8812] : You have entered Clearfell.')).toEqual({
      type: 'areaEntered',
      name: 'Clearfell',
    });
  });

  it('reads the PoE 2 scene line and ignores the empty scene', () => {
    expect(parseLogLine('2026/11/20 19:02:31 1 a [INFO Client 1] [SCENE] Set Source [The Grim Tangle]')).toEqual({
      type: 'areaEntered',
      name: 'The Grim Tangle',
    });
    expect(parseLogLine('2026/11/20 19:02:31 1 a [INFO Client 1] [SCENE] Set Source [(null)]')).toBeNull();
  });

  it('accepts the guessed Polish variants', () => {
    for (const verb of ['Wkroczono do', 'Wszedłeś do', 'Weszłaś do']) {
      expect(parseLogLine(`2026/11/20 19:02:31 1 a [INFO Client 1] : ${verb} Przejście Zdrajcy.`)).toEqual({
        type: 'areaEntered',
        name: 'Przejście Zdrajcy',
      });
    }
  });

  it('recognises local chat only', () => {
    expect(parseLogLine('2026/11/20 19:02:05 1 a [INFO Client 1] ExileOne: anyone for Count Geonor?')).toEqual({
      type: 'chat',
      speaker: 'ExileOne',
      message: 'anyone for Count Geonor?',
    });
    expect(parseLogLine('2026/11/20 19:02:15 1 a [INFO Client 1] <GLD> ExileOne: inviting')).toMatchObject({
      speaker: 'ExileOne',
    });
    expect(parseLogLine('2026/11/20 19:02:09 1 a [INFO Client 1] #RandomGuy: WTS chaos')).toBeNull();
    expect(parseLogLine('2026/11/20 19:02:09 1 a [INFO Client 1] $Trader: WTB')).toBeNull();
    expect(parseLogLine('2026/11/20 19:02:09 1 a [INFO Client 1] %Party: go')).toBeNull();
    expect(parseLogLine('2026/11/20 19:02:10 1 a [INFO Client 1] @From Trader_X: Hi')).toBeNull();
    expect(parseLogLine('2026/11/20 19:02:16 1 a [INFO Client 1] : OtherPlayer has joined the area.')).toBeNull();
  });

  it('ignores lines that are not game lines', () => {
    expect(parseLogLine('random text')).toBeNull();
    expect(stripLinePrefix('')).toBeNull();
    expect(parseLogLine('2026/11/20 19:01:55 98234511 2caa1679 [INFO Client 8812] [ENGINE] Init')).toBeNull();
  });

  it('tolerates Windows line endings', () => {
    expect(parseLogLine('2026/11/20 19:02:31 1 a [INFO Client 1] : You have entered Clearfell.\r')).toMatchObject({
      name: 'Clearfell',
    });
  });
});

describe('applyLogLines', () => {
  it('ends in the last entered area with its level', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, sample);
    expect(state.area).toEqual({ name: 'The Grim Tangle', level: 15 });
    expect(state.pendingLevel).toBeNull();
  });

  it('keeps the level when the scene line and "You have entered" both arrive', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, sample.slice(0, 5));
    expect(state.area).toEqual({ name: 'Clearfell Encampment', level: 1 });
  });

  it('suggests the most frequent local speaker', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, sample);
    expect(suggestNick(state.recentSpeakers)).toBe('ExileOne');
  });
});

describe('suggestNick', () => {
  it('returns null without chat', () => {
    expect(suggestNick([])).toBeNull();
  });
  it('breaks ties towards the latest speaker', () => {
    expect(suggestNick(['A_one', 'B_two'])).toBe('B_two');
  });
});

describe('splitLines', () => {
  it('keeps the incomplete tail in the buffer', () => {
    const first = splitLines('', 'line one\r\nline tw');
    expect(first).toEqual({ lines: ['line one'], rest: 'line tw' });
    const second = splitLines(first.rest, 'o\n');
    expect(second).toEqual({ lines: ['line two'], rest: '' });
  });
});

describe('nick i poziom postaci z awansów (0.1.1)', () => {
  const P = '2026/11/24 19:02:11 123456789 cff94598 [INFO Client 1234] ';

  it('czyta awans postaci', () => {
    expect(parseLogLine(`${P}: Dawnbringer (Mercenary) is now level 41`)).toEqual({
      type: 'levelUp',
      name: 'Dawnbringer',
      className: 'Mercenary',
      level: 41,
    });
  });

  it('dialog NPC nie jest nickiem gracza', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, [
      `${P}Doryani: Ah, the Exile returns.`,
      `${P}Doryani: The Vaal knew things we have forgotten.`,
      `${P}: Dawnbringer (Mercenary) is now level 40`,
      `${P}Doryani: Come, there is more to see.`,
      `${P}: Dawnbringer (Mercenary) is now level 41`,
    ]);
    expect(currentCharacter(state.levelUps)).toEqual({ name: 'Dawnbringer', className: 'Mercenary', level: 41 });
  });

  it('członek drużyny awansujący raz nie podmienia postaci', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, [
      `${P}: Dawnbringer (Mercenary) is now level 40`,
      `${P}: Dawnbringer (Mercenary) is now level 41`,
      `${P}: Kolega (Witch) is now level 55`,
    ]);
    expect(currentCharacter(state.levelUps)?.name).toBe('Dawnbringer');
  });

  it('bez awansu w logu nie zgadujemy nicku', () => {
    const state = applyLogLines(INITIAL_LOG_STATE, [`${P}Doryani: Hello.`]);
    expect(currentCharacter(state.levelUps)).toBeNull();
  });
});
