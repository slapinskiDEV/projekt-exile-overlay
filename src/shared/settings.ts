import type { OverlayProfile } from './api-types';
import { DEFAULT_SHORTCUTS, type ShortcutMap } from './shortcuts';

/** Ustawienia zapisane w `settings.json` w katalogu danych aplikacji. */
export interface StoredSettings {
  /** Gracz zobaczył ekran prywatności i kliknął „Rozumiem”. */
  privacyAccepted: boolean;
  /** Kreator pierwszego uruchomienia zakończony. */
  setupDone: boolean;
  league: string | null;
  /** `paired` — konto połączone, `preview` — tylko podgląd. */
  mode: 'paired' | 'preview' | null;
  nick: string;
  clientTxtPath: string | null;
  shortcuts: ShortcutMap;
  soundEnabled: boolean;
  /** Zakończone kontrakty schowane przez gracza w zakładce „Moje” (0.3.4). */
  hiddenContracts: string[];
  profile: OverlayProfile | null;
  /** Token urządzenia zaszyfrowany `safeStorage` (base64). */
  tokenEncrypted: string | null;
  /** Token jawnym tekstem — tylko gdy system nie udostępnia szyfrowania. */
  tokenPlain: string | null;
}

/** Ile schowanych kontraktów pamiętamy — starsze i tak nie wracają w „Moje”. */
export const MAX_HIDDEN_CONTRACTS = 200;

export const DEFAULT_SETTINGS: StoredSettings = {
  privacyAccepted: false,
  setupDone: false,
  league: null,
  mode: null,
  nick: '',
  clientTxtPath: null,
  shortcuts: DEFAULT_SHORTCUTS,
  soundEnabled: true,
  hiddenContracts: [],
  profile: null,
  tokenEncrypted: null,
  tokenPlain: null,
};

/** Wczytane z dysku dane łączone z domyślnymi — odporne na stary albo zepsuty plik. */
export function mergeSettings(raw: unknown): StoredSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const value = raw as Partial<Record<keyof StoredSettings, unknown>>;
  const str = (v: unknown, fallback: string | null) => (typeof v === 'string' ? v : fallback);
  const shortcuts = value.shortcuts && typeof value.shortcuts === 'object' ? (value.shortcuts as Partial<ShortcutMap>) : {};
  return {
    privacyAccepted: value.privacyAccepted === true,
    setupDone: value.setupDone === true,
    league: str(value.league, null),
    mode: value.mode === 'paired' || value.mode === 'preview' ? value.mode : null,
    nick: str(value.nick, '') ?? '',
    clientTxtPath: str(value.clientTxtPath, null),
    shortcuts: {
      togglePanel: typeof shortcuts.togglePanel === 'string' ? shortcuts.togglePanel : DEFAULT_SHORTCUTS.togglePanel,
      requestHelp: typeof shortcuts.requestHelp === 'string' ? shortcuts.requestHelp : DEFAULT_SHORTCUTS.requestHelp,
      offerHelp: typeof shortcuts.offerHelp === 'string' ? shortcuts.offerHelp : DEFAULT_SHORTCUTS.offerHelp,
      askItem: typeof shortcuts.askItem === 'string' ? shortcuts.askItem : DEFAULT_SHORTCUTS.askItem,
    },
    soundEnabled: value.soundEnabled !== false,
    hiddenContracts: Array.isArray(value.hiddenContracts)
      ? value.hiddenContracts.filter((id): id is string => typeof id === 'string').slice(-MAX_HIDDEN_CONTRACTS)
      : [],
    profile: value.profile && typeof value.profile === 'object' ? (value.profile as OverlayProfile) : null,
    tokenEncrypted: str(value.tokenEncrypted, null),
    tokenPlain: str(value.tokenPlain, null),
  };
}

/** Ustawienia widoczne dla interfejsu — bez tokenu. */
export type PublicSettings = Omit<StoredSettings, 'tokenEncrypted' | 'tokenPlain'>;

export function toPublicSettings(settings: StoredSettings): PublicSettings {
  const { tokenEncrypted: _e, tokenPlain: _p, ...rest } = settings;
  return rest;
}
