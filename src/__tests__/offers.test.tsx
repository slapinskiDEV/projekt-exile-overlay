// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createApiClient } from '../main/api';
import { OfferActions } from '../renderer/src/overlay/OfferBox';
import { ContractRow } from '../renderer/src/overlay/ContractRow';
import type { ContractDetailResponse, OverlayContract } from '../shared/api-types';

afterEach(cleanup);

const base: OverlayContract = {
  id: 'c1',
  title: 'Pomogę zabić Arbitra',
  description: '',
  status: 'open',
  contractType: 'individual',
  categoryId: 'boss_carry',
  categoryLabel: 'Pomoc z bossem',
  league: null,
  area: null,
  areaLevel: null,
  rpValue: 1,
  helpersCount: 1,
  maxHelpers: 3,
  issuer: { id: 'author', name: 'Autor' },
  createdAt: new Date().toISOString(),
  areaRank: 2,
  kind: 'offer',
  payment: { currency: 'divine-orb', amount: 1, name: 'Divine Orb', iconUrl: 'https://www.projektexile.pl/currency/poe2/divine-orb.webp' },
};

const detail = (status: string, offerResult: 'awaiting' | null = null): ContractDetailResponse['contract'] => ({
  ...base,
  status: status as OverlayContract['status'],
  itemText: null,
  contractorId: null,
  expiryWarnedAt: null,
  ...(offerResult ? {} : {}),
});

const applications = (offerResult: 'awaiting' | null = null): ContractDetailResponse['applications'] => [
  { id: 'a1', applicantId: 'me', applicantName: 'Ja', status: 'accepted', message: null, createdAt: '', offerResult },
];

describe('oferty w overlayu', () => {
  it('wiersz pokazuje ofertę, miejsca i cenę', () => {
    render(<ContractRow contract={base} onOpen={() => {}} />);
    expect(screen.getByText('Oferta')).toBeTruthy();
    expect(screen.getByText(/miejsca 1\/3/)).toBeTruthy();
    expect(screen.getByText(/Divine Orb/)).toBeTruthy();
  });

  it('gracz dołącza do oferty', () => {
    const joinOffer = vi.fn(async () => ({ ok: true, data: { ok: true } }));
    (window as unknown as { overlay: unknown }).overlay = { joinOffer };
    const perform = vi.fn(async (fn: () => Promise<unknown>) => {
      await fn();
      return true;
    });
    render(<OfferActions contract={detail('open')} applications={[]} me="other" paired pending={false} perform={perform as never} />);
    fireEvent.click(screen.getByText('Dołącz'));
    expect(joinOffer).toHaveBeenCalledWith('c1');
  });

  it('klient po „Wykonane” widzi „Potwierdzam”', () => {
    const confirmOffer = vi.fn(async () => ({ ok: true, data: { ok: true } }));
    (window as unknown as { overlay: unknown }).overlay = { confirmOffer };
    const perform = vi.fn(async (fn: () => Promise<unknown>) => {
      await fn();
      return true;
    });
    render(
      <OfferActions contract={detail('completed')} applications={applications('awaiting')} me="me" paired pending={false} perform={perform as never} />,
    );
    fireEvent.click(screen.getByText('Potwierdzam'));
    expect(confirmOffer).toHaveBeenCalledWith('c1');
  });

  it('autor zaznacza obecnych w „Wykonane”', () => {
    const completeOffer = vi.fn(async () => ({ ok: true, data: { ok: true } }));
    (window as unknown as { overlay: unknown }).overlay = { completeOffer };
    const perform = vi.fn(async (fn: () => Promise<unknown>) => {
      await fn();
      return true;
    });
    render(
      <OfferActions contract={detail('in_progress')} applications={applications()} me="author" paired pending={false} perform={perform as never} />,
    );
    fireEvent.click(screen.getByText('Wykonane'));
    fireEvent.click(screen.getByText('Potwierdź obecnych (1)'));
    expect(completeOffer).toHaveBeenCalledWith('c1', ['me']);
  });
});

describe('api: oferty', () => {
  it('lista wysyła rodzaj i zapłatę, zamknięcie oferty — powód', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ contracts: [] }), { status: 200 }));
    const api = createApiClient({ baseUrl: 'https://x.test', version: '0.2.0', getToken: () => 't', fetch });
    await api.contracts({ kind: 'offer', pay: 'paid' });
    expect(String((fetch.mock.calls[0] as unknown as [URL])[0])).toBe('https://x.test/contracts?kind=offer&pay=paid');
    await api.close('c1', 'Wypadło mi');
    const [, init] = fetch.mock.calls[1] as unknown as [URL, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Wypadło mi' });
  });
});
