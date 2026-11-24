import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * Wysłanie Ctrl+C do gry (Alt+C, spec 0158). Jedno wywołanie = jedno naciśnięcie
 * w grze. Interfejs pozwala podmienić implementację (np. na moduł natywny).
 */
export interface KeySender {
  sendCopy(): Promise<void>;
  dispose(): void;
}

/**
 * Bez modułów natywnych: stały proces PowerShella z `SendKeys`. Proces startuje raz
 * (start PowerShella trwa ~0,5 s), potem każda komenda `copy` to jedno
 * `SendWait('^c')`. Jeśli gracz wciąż trzyma Alt, gra dostaje Ctrl+Alt+C — PoE 2
 * kopiuje wtedy rozszerzony opis przedmiotu, który parser też rozumie.
 */
const SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($line -eq $null) { break }',
  "  if ($line -eq 'copy') {",
  "    [System.Windows.Forms.SendKeys]::SendWait('^c')",
  "    [Console]::Out.WriteLine('ok')",
  '    [Console]::Out.Flush()',
  '  }',
  '}',
].join('\n');

export function encodePowerShell(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

export class PowerShellKeySender implements KeySender {
  private child: ChildProcessWithoutNullStreams | null = null;
  private waiting: Array<() => void> = [];

  warmUp(): void {
    this.ensure();
  }

  private ensure(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null && !this.child.killed) return this.child;
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encodePowerShell(SCRIPT)],
      { windowsHide: true, stdio: 'pipe' },
    );
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      const count = chunk.split('ok').length - 1;
      for (let i = 0; i < count; i++) this.waiting.shift()?.();
    });
    child.on('exit', () => {
      if (this.child === child) this.child = null;
      const pending = this.waiting;
      this.waiting = [];
      pending.forEach((resolve) => resolve());
    });
    child.on('error', () => {
      if (this.child === child) this.child = null;
    });
    this.child = child;
    return child;
  }

  sendCopy(): Promise<void> {
    return new Promise((resolve) => {
      const child = this.ensure();
      const timeout = setTimeout(() => {
        this.waiting = this.waiting.filter((fn) => fn !== done);
        resolve();
      }, 3000);
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.waiting.push(done);
      child.stdin.write('copy\n');
    });
  }

  dispose(): void {
    this.child?.stdin.end();
    this.child?.kill();
    this.child = null;
  }
}

/** Na innych systemach (dev na macOS) — nic nie wysyłamy. */
export class NoopKeySender implements KeySender {
  async sendCopy(): Promise<void> {}
  dispose(): void {}
}

export function createKeySender(platform: NodeJS.Platform = process.platform): KeySender {
  return platform === 'win32' ? new PowerShellKeySender() : new NoopKeySender();
}

/**
 * Alt+C: jedno Ctrl+C do gry, krótka pauza, jeden odczyt schowka. Zwraca tekst ze
 * schowka — sprawdzenie, czy to przedmiot, robi wywołujący.
 */
export async function copyItemFromGame(
  sender: KeySender,
  readClipboard: () => string | Promise<string>,
  delayMs = 200,
): Promise<string> {
  await sender.sendCopy();
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  try {
    return await readClipboard();
  } catch {
    return '';
  }
}
