import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mergeSettings, type StoredSettings } from '@shared/settings';

/**
 * Ustawienia w jednym pliku JSON. Token urządzenia jest szyfrowany przez
 * `safeStorage` (DPAPI na Windows) — szyfrowanie wstrzykuje proces główny, żeby ten
 * moduł dało się testować bez Electrona.
 */
export interface TokenCipher {
  available(): boolean;
  encrypt(plain: string): string;
  decrypt(encrypted: string): string;
}

export class SettingsStore {
  private value: StoredSettings;

  constructor(
    private readonly file: string,
    private readonly cipher: TokenCipher,
  ) {
    this.value = SettingsStore.load(file);
  }

  static load(file: string): StoredSettings {
    try {
      return mergeSettings(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return mergeSettings(null);
    }
  }

  get(): StoredSettings {
    return this.value;
  }

  update(patch: Partial<StoredSettings>): StoredSettings {
    this.value = mergeSettings({ ...this.value, ...patch });
    this.save();
    return this.value;
  }

  getToken(): string | null {
    if (this.value.tokenEncrypted) {
      try {
        return this.cipher.decrypt(this.value.tokenEncrypted);
      } catch {
        return null;
      }
    }
    return this.value.tokenPlain;
  }

  setToken(token: string | null): void {
    if (!token) {
      this.update({ tokenEncrypted: null, tokenPlain: null });
    } else if (this.cipher.available()) {
      this.update({ tokenEncrypted: this.cipher.encrypt(token), tokenPlain: null });
    } else {
      this.update({ tokenEncrypted: null, tokenPlain: token });
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.value, null, 2), 'utf8');
    renameSync(tmp, this.file);
  }
}
