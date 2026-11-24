import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../main/api';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('api client', () => {
  it('sends the version header, the bearer token and the query', async () => {
    const fetch = fakeFetch(200, { contracts: [] });
    const api = createApiClient({ baseUrl: 'https://example.test/api/overlay/', version: '0.1.0', getToken: () => 'pex_t', fetch });
    const result = await api.contracts({ league: 'Dawn', area: 'Clearfell', areaLevel: 3, category: null });
    expect(result).toEqual({ ok: true, data: { contracts: [] } });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://example.test/api/overlay/contracts?league=Dawn&area=Clearfell&areaLevel=3');
    const headers = init!.headers as Record<string, string>;
    expect(headers['X-Overlay-Version']).toBe('0.1.0');
    expect(headers.Authorization).toBe('Bearer pex_t');
  });

  it('does not send the token when pairing', async () => {
    const fetch = fakeFetch(201, { token: 'pex_new', user: { id: 'u' } });
    const api = createApiClient({ baseUrl: 'https://x.test', version: '0.1.0', getToken: () => 'old', fetch });
    await api.pair({ code: 'ABCD1234' });
    const headers = fetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ code: 'ABCD1234' });
  });

  it('reports 426 as update required', async () => {
    const onUpdateRequired = vi.fn();
    const api = createApiClient({
      baseUrl: 'https://x.test',
      version: '0.1.0',
      getToken: () => null,
      onUpdateRequired,
      fetch: fakeFetch(426, { error: 'update_required', message: 'Zaktualizuj overlay', minVersion: '0.2.0' }),
    });
    const result = await api.contracts({});
    expect(result.ok).toBe(false);
    expect(onUpdateRequired).toHaveBeenCalledWith('0.2.0');
  });

  it('reports a revoked device', async () => {
    const onRevoked = vi.fn();
    const api = createApiClient({
      baseUrl: 'https://x.test',
      version: '0.1.0',
      getToken: () => 'pex_t',
      onRevoked,
      fetch: fakeFetch(401, { error: 'device_revoked', message: 'Odłączone' }),
    });
    const result = await api.me();
    expect(result).toEqual({ ok: false, error: { status: 401, error: 'device_revoked', message: 'Odłączone' } });
    expect(onRevoked).toHaveBeenCalledOnce();
  });

  it('turns a network failure into a Polish message', async () => {
    const api = createApiClient({
      baseUrl: 'https://x.test',
      version: '0.1.0',
      getToken: () => null,
      fetch: vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    });
    const result = await api.leagues();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(0);
  });

  it('posts the finish payload', async () => {
    const fetch = fakeFetch(200, { ok: true });
    const api = createApiClient({ baseUrl: 'https://x.test', version: '0.1.0', getToken: () => 't', fetch });
    await api.finish('id-1', { helperIds: ['a', 'b'] });
    expect(String(fetch.mock.calls[0]![0])).toBe('https://x.test/contracts/id-1/finish');
    expect(fetch.mock.calls[0]![1]!.method).toBe('POST');
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ helperIds: ['a', 'b'] });
  });
});

describe('przekierowania (0.1.1)', () => {
  it('domyślny adres to www — bez przekierowania gubiącego token', async () => {
    const { DEFAULT_API_URL } = await import('../main/api');
    expect(DEFAULT_API_URL).toBe('https://www.projektexile.pl/api/overlay');
  });

  it('przy przekierowaniu w obrębie projektexile.pl token zostaje', async () => {
    const { createApiClient } = await import('../main/api');
    const calls: Array<{ url: string; auth: string | undefined }> = [];
    const fakeFetch = (async (input: URL | string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
      if (url.startsWith('https://projektexile.pl/')) {
        return new Response(null, {
          status: 308,
          headers: { location: url.replace('https://projektexile.pl/', 'https://www.projektexile.pl/') },
        });
      }
      return new Response(JSON.stringify({ id: 'c1' }), { status: 201 });
    }) as typeof fetch;

    const api = createApiClient({
      baseUrl: 'https://projektexile.pl/api/overlay',
      version: '0.1.1',
      getToken: () => 'pex_token',
      fetch: fakeFetch,
    });
    const result = await api.createContract({ categoryId: 'boss_carry', text: 'Pomocy z bossem' });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ url: 'https://www.projektexile.pl/api/overlay/contracts', auth: 'Bearer pex_token' });
  });

  it('nie wysyła tokenu poza projektexile.pl', async () => {
    const { isTrustedRedirect } = await import('../main/api');
    const from = new URL('https://www.projektexile.pl/api/overlay/me');
    expect(isTrustedRedirect(from, new URL('https://projektexile.pl/x'))).toBe(true);
    expect(isTrustedRedirect(from, new URL('https://evil.example/x'))).toBe(false);
    expect(isTrustedRedirect(from, new URL('http://www.projektexile.pl/x'))).toBe(false);
    expect(isTrustedRedirect(from, new URL('https://projektexile.pl.evil.example/x'))).toBe(false);
  });
});
