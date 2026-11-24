import { describe, expect, it, vi } from 'vitest';
import { copyItemFromGame, encodePowerShell, type KeySender } from '../main/key-sender';

describe('copyItemFromGame', () => {
  it('sends exactly one copy and reads the clipboard once', async () => {
    const sender: KeySender = { sendCopy: vi.fn(async () => undefined), dispose: vi.fn() };
    const read = vi.fn(async () => 'Rarity: Rare');
    expect(await copyItemFromGame(sender, read, 1)).toBe('Rarity: Rare');
    expect(sender.sendCopy).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
  });

  it('encodes PowerShell as UTF-16LE base64', () => {
    expect(Buffer.from(encodePowerShell('ok'), 'base64').toString('utf16le')).toBe('ok');
  });
});
