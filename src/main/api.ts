import type {
  CategoriesResponse,
  ContractDetailResponse,
  ContractsResponse,
  CreateContractRequest,
  CreateThreadRequest,
  CreatedResponse,
  CurrenciesResponse,
  FinishContractRequest,
  LeaguesResponse,
  MeResponse,
  NotificationsResponse,
  OverlayError,
  PairRequest,
  PairResponse,
  ProblemReportRequest,
  RealtimeResponse,
  ThreadDetailResponse,
  ThreadsResponse,
  VersionResponse,
} from '@shared/api-types';
import type { ApiFailure, ApiResult, ContractsQuery } from '@shared/ipc';

/**
 * Klient API overlaya (`/api/overlay`). Działa w procesie głównym — bez CORS i bez
 * tokenu w interfejsie. Nie importuje Electrona, więc jest testowany w vitest.
 */

// Kanoniczny adres serwisu to `www` — `projektexile.pl` odpowiada przekierowaniem 308,
// a `fetch` przy przekierowaniu na inny host usuwa nagłówek `Authorization`. W 0.1.0
// skutkowało to „Połącz overlay z kontem” przy każdym zapisie mimo sparowania.
export const DEFAULT_API_URL = 'https://www.projektexile.pl/api/overlay';

/** Przekierowanie w obrębie projektexile.pl możemy śledzić z tokenem. */
export function isTrustedRedirect(from: URL, to: URL): boolean {
  const site = (host: string) => host === 'projektexile.pl' || host.endsWith('.projektexile.pl');
  return to.protocol === 'https:' && (to.host === from.host || (site(from.hostname) && site(to.hostname)));
}

export interface ApiClientOptions {
  baseUrl: string;
  version: string;
  getToken: () => string | null;
  /** HTTP 426 — wersja nieobsługiwana. */
  onUpdateRequired?: (minVersion: string) => void;
  /** HTTP 401 `device_revoked` — urządzenie odłączone od konta. */
  onRevoked?: () => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type Method = 'GET' | 'POST' | 'DELETE';

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function request<T>(
    method: Method,
    path: string,
    init: { body?: unknown; query?: Record<string, string | number | null | undefined>; auth?: boolean } = {},
  ): Promise<ApiResult<T>> {
    const url = new URL(`${base}/${path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      'X-Overlay-Version': options.version,
      Accept: 'application/json',
    };
    const token = init.auth === false ? null : options.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      // Przekierowania śledzimy sami (najwyżej 3), żeby nie zgubić tokenu i nie wysłać
      // go poza projektexile.pl.
      let target = url;
      for (let hop = 0; ; hop++) {
        response = await doFetch(target, {
          method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
          redirect: 'manual',
        });
        const location = response.headers?.get?.('location');
        if (![301, 302, 307, 308].includes(response.status) || !location || hop >= 3) break;
        const next = new URL(location, target);
        if (!isTrustedRedirect(target, next)) break;
        target = next;
      }
    } catch {
      return failure({ status: 0, error: 'network', message: 'Brak połączenia z serwerem. Spróbuj za chwilę.' });
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (response.ok) return { ok: true, data: payload as T };

    const body = (payload && typeof payload === 'object' ? payload : {}) as Partial<OverlayError>;
    const error: ApiFailure = {
      status: response.status,
      error: typeof body.error === 'string' ? body.error : 'action_failed',
      message: typeof body.message === 'string' ? body.message : 'Coś poszło nie tak. Spróbuj ponownie.',
      ...(typeof body.minVersion === 'string' ? { minVersion: body.minVersion } : {}),
    };

    if (response.status === 426) options.onUpdateRequired?.(error.minVersion ?? options.version);
    if (response.status === 401 && error.error === 'device_revoked') options.onRevoked?.();

    return failure(error);
  }

  function failure<T>(error: ApiFailure): ApiResult<T> {
    return { ok: false, error };
  }

  return {
    version: () => request<VersionResponse>('GET', 'version', { auth: false }),
    leagues: () => request<LeaguesResponse>('GET', 'leagues', { auth: false }),
    categories: () => request<CategoriesResponse>('GET', 'categories', { auth: false }),
    pair: (body: PairRequest) => request<PairResponse>('POST', 'pair', { body, auth: false }),
    contracts: (query: ContractsQuery) => request<ContractsResponse>('GET', 'contracts', { query: { ...query } }),
    contract: (id: string) => request<ContractDetailResponse>('GET', `contracts/${encodeURIComponent(id)}`),
    createContract: (body: CreateContractRequest) => request<CreatedResponse>('POST', 'contracts', { body }),
    apply: (id: string, message?: string) =>
      request<{ id: string | null }>('POST', `contracts/${encodeURIComponent(id)}/apply`, {
        body: message ? { message } : {},
      }),
    sendMessage: (id: string, content: string) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/messages`, { body: { content } }),
    extend: (id: string) => request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/extend`, { body: {} }),
    close: (id: string, reason?: string) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/close`, { body: reason ? { reason } : {} }),
    // Oferty i zgłoszenia problemu (spec 0192 serwisu)
    currencies: (game: 'poe1' | 'poe2') => request<CurrenciesResponse>('GET', 'currencies', { query: { game }, auth: false }),
    joinOffer: (id: string) => request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/join`, { body: {} }),
    leaveOffer: (id: string) => request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/leave`, { body: {} }),
    removeFromOffer: (id: string, userId: string) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/remove`, { body: { userId } }),
    startOffer: (id: string) => request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/start`, { body: {} }),
    completeOffer: (id: string, userIds: string[]) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/done`, { body: { userIds } }),
    confirmOffer: (id: string) => request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/confirm`, { body: {} }),
    relistOffer: (id: string) => request<CreatedResponse>('POST', `contracts/${encodeURIComponent(id)}/relist`, { body: {} }),
    reportProblem: (id: string, body: ProblemReportRequest) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/report`, { body }),
    finish: (id: string, body: FinishContractRequest) =>
      request<{ ok: true }>('POST', `contracts/${encodeURIComponent(id)}/finish`, { body }),
    acceptApplication: (id: string) =>
      request<{ ok: true }>('POST', `applications/${encodeURIComponent(id)}/accept`, { body: {} }),
    withdrawApplication: (id: string) =>
      request<{ ok: true }>('POST', `applications/${encodeURIComponent(id)}/withdraw`, { body: {} }),
    threads: (league?: string | null) => request<ThreadsResponse>('GET', 'threads', { query: { league } }),
    thread: (id: string) => request<ThreadDetailResponse>('GET', `threads/${encodeURIComponent(id)}`),
    createThread: (body: CreateThreadRequest) => request<CreatedResponse>('POST', 'threads', { body }),
    replyToThread: (id: string, content: string) =>
      request<{ id: string | null }>('POST', `threads/${encodeURIComponent(id)}/posts`, { body: { content } }),
    me: () => request<MeResponse>('GET', 'me'),
    notifications: () => request<NotificationsResponse>('GET', 'notifications'),
    markRead: (ids: string[]) => request<{ ok: true }>('POST', 'notifications/read', { body: { ids } }),
    realtime: () => request<RealtimeResponse>('GET', 'realtime'),
    disconnect: () => request<{ ok: true }>('DELETE', 'device'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
