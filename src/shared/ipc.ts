import type {
  CategoriesResponse,
  ContractDetailResponse,
  ContractsResponse,
  CreateContractRequest,
  CreateThreadRequest,
  CreatedResponse,
  CurrenciesResponse,
  ProblemReportRequest,
  LeaguesResponse,
  MeResponse,
  OverlayNotification,
  PairResponse,
  ThreadDetailResponse,
  ThreadsResponse,
} from './api-types';
import type { AreaInfo } from './log-parser';
import type { PublicSettings } from './settings';
import type { ShortcutAction, ShortcutMap } from './shortcuts';

/** Filtry listy kontraktów. `kind` / `pay` — oferty i zapłata (od 0.2.0). */
export interface ContractsQuery {
  league?: string | null;
  category?: string | null;
  area?: string | null;
  areaLevel?: number | null;
  kind?: 'request' | 'offer' | null;
  pay?: 'free' | 'paid' | null;
}

/** Błąd zapytania do API w kształcie, który przechodzi przez IPC. */
export interface ApiFailure {
  /** Kod HTTP; 0 — brak połączenia. */
  status: number;
  error: string;
  message: string;
  minVersion?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export interface AppState {
  version: string;
  settings: PublicSettings;
  paired: boolean;
  area: AreaInfo | null;
  nickHint: string | null;
  /** Postać z ostatniego awansu w logu (nick, klasa, poziom). */
  character: { name: string; className: string; level: number } | null;
  /** Ustawione, gdy API odrzuca tę wersję (HTTP 426 albo /version). */
  updateRequired: { minVersion: string } | null;
  panelVisible: boolean;
  log: { status: 'idle' | 'watching' | 'missing'; path: string | null };
  /** Błędy rejestracji skrótów (zajęte przez inną aplikację). */
  shortcutErrors: Partial<Record<ShortcutAction, string>>;
}

/** Co pokazać w panelu po skrócie albo kliknięciu w zasobniku. */
export type PanelCommand =
  | { kind: 'list' }
  | { kind: 'request'; categoryId?: string; itemText?: string | null; offer?: boolean }
  | { kind: 'item-not-found' }
  | { kind: 'contract'; id: string };

/** Metody wywoływane z interfejsu (`ipcRenderer.invoke`). */
export interface OverlayApi {
  getState(): Promise<AppState>;
  updateSettings(patch: Partial<PublicSettings>): Promise<AppState>;
  acceptPrivacy(): Promise<AppState>;
  finishSetup(): Promise<AppState>;
  setShortcuts(map: ShortcutMap): Promise<{ ok: boolean; errors: Partial<Record<ShortcutAction, string>> }>;
  suspendShortcuts(suspended: boolean): Promise<void>;

  detectClientTxt(): Promise<string[]>;
  chooseClientTxt(): Promise<string | null>;

  pair(code: string): Promise<ApiResult<PairResponse>>;
  usePreviewMode(): Promise<AppState>;
  disconnect(): Promise<AppState>;

  leagues(): Promise<ApiResult<LeaguesResponse>>;
  categories(): Promise<ApiResult<CategoriesResponse>>;
  contracts(query: ContractsQuery): Promise<ApiResult<ContractsResponse>>;
  contract(id: string): Promise<ApiResult<ContractDetailResponse>>;
  createContract(body: CreateContractRequest): Promise<ApiResult<CreatedResponse>>;
  apply(contractId: string, message?: string): Promise<ApiResult<{ id: string | null }>>;
  sendMessage(contractId: string, content: string): Promise<ApiResult<{ ok: true }>>;
  extend(contractId: string): Promise<ApiResult<{ ok: true }>>;
  close(contractId: string, reason?: string): Promise<ApiResult<{ ok: true }>>;
  currencies(game: 'poe1' | 'poe2'): Promise<ApiResult<CurrenciesResponse>>;
  joinOffer(contractId: string): Promise<ApiResult<{ ok: true }>>;
  leaveOffer(contractId: string): Promise<ApiResult<{ ok: true }>>;
  removeFromOffer(contractId: string, userId: string): Promise<ApiResult<{ ok: true }>>;
  startOffer(contractId: string): Promise<ApiResult<{ ok: true }>>;
  completeOffer(contractId: string, userIds: string[]): Promise<ApiResult<{ ok: true }>>;
  confirmOffer(contractId: string): Promise<ApiResult<{ ok: true }>>;
  relistOffer(contractId: string): Promise<ApiResult<CreatedResponse>>;
  reportProblem(contractId: string, body: ProblemReportRequest): Promise<ApiResult<{ ok: true }>>;
  finish(contractId: string, helperIds: string[]): Promise<ApiResult<{ ok: true }>>;
  acceptApplication(applicationId: string): Promise<ApiResult<{ ok: true }>>;
  withdrawApplication(applicationId: string): Promise<ApiResult<{ ok: true }>>;
  threads(league?: string | null): Promise<ApiResult<ThreadsResponse>>;
  thread(id: string): Promise<ApiResult<ThreadDetailResponse>>;
  createThread(body: CreateThreadRequest): Promise<ApiResult<CreatedResponse>>;
  replyToThread(threadId: string, content: string): Promise<ApiResult<{ id: string | null }>>;
  me(): Promise<ApiResult<MeResponse>>;

  setPanelVisible(visible: boolean): Promise<void>;
  /** Kursor nad elementem panelu/okienka — okno ma łapać kliknięcia. */
  setInteractive(interactive: boolean): Promise<void>;
  openExternal(url: string): Promise<void>;
  openSettings(): Promise<void>;
  checkForUpdates(): Promise<void>;
  copyText(text: string): Promise<void>;
}

export type OverlayApiMethod = keyof OverlayApi;

/** Lista kanałów — preload buduje z niej obiekt `window.overlay`. */
export const OVERLAY_API_METHODS: OverlayApiMethod[] = [
  'getState',
  'updateSettings',
  'acceptPrivacy',
  'finishSetup',
  'setShortcuts',
  'suspendShortcuts',
  'detectClientTxt',
  'chooseClientTxt',
  'pair',
  'usePreviewMode',
  'disconnect',
  'leagues',
  'categories',
  'contracts',
  'contract',
  'createContract',
  'apply',
  'sendMessage',
  'extend',
  'close',
  'currencies',
  'joinOffer',
  'leaveOffer',
  'removeFromOffer',
  'startOffer',
  'completeOffer',
  'confirmOffer',
  'relistOffer',
  'reportProblem',
  'finish',
  'acceptApplication',
  'withdrawApplication',
  'threads',
  'thread',
  'createThread',
  'replyToThread',
  'me',
  'setPanelVisible',
  'setInteractive',
  'openExternal',
  'openSettings',
  'checkForUpdates',
  'copyText',
];

/** Zdarzenia wysyłane z procesu głównego do interfejsu. */
export interface OverlayEvents {
  state: AppState;
  panel: PanelCommand;
  notification: OverlayNotification;
  /** Druga strona coś zmieniła w kontrakcie (0.3.4) — widoki przeładowują dane od razu. */
  'contract-changed': string;
}

export type OverlayEventName = keyof OverlayEvents;

export interface OverlayBridge extends OverlayApi {
  on<E extends OverlayEventName>(event: E, listener: (payload: OverlayEvents[E]) => void): () => void;
}

export const SITE_URL = 'https://www.projektexile.pl';
export const PAIRING_URL = `${SITE_URL}/profile/settings#overlay`;
export const RELEASES_URL = 'https://github.com/slapinskiDEV/projekt-exile-overlay/releases/latest';
export const GGG_DISCLAIMER =
  "This product isn't affiliated with or endorsed by Grinding Gear Games in any way.";
