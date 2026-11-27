// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AppState } from '@shared/ipc';
import { MyContracts } from '../renderer/src/overlay/MyContracts';

afterEach(cleanup);

const base = {
  title: 'Pomogę zabić Arbitra',
  description: '',
  contractType: 'individual',
  categoryId: 'boss',
  categoryLabel: 'Bossowie',
  league: null,
  area: null,
  areaLevel: null,
  rpValue: 2,
  helpersCount: 0,
  maxHelpers: 3,
  issuer: { id: 'u1', name: 'Ja' },
  createdAt: new Date().toISOString(),
  areaRank: 2,
  payment: null,
};

const updateSettings = vi.fn(async () => ({}));
const relistOffer = vi.fn(async () => ({ ok: true, data: { id: 'new' } }));
(window as unknown as { overlay: unknown }).overlay = {
  me: async () => ({
    ok: true,
    data: {
      profile: { displayName: 'Ja', level: 3, reputation: 10 },
      contracts: [
        { ...base, id: 'a', status: 'open', kind: 'offer', role: 'issuer' },
        { ...base, id: 'b', title: 'Stara oferta', status: 'verified', kind: 'offer', role: 'issuer' },
        { ...base, id: 'c', title: 'Schowana', status: 'cancelled', kind: 'request', role: 'issuer' },
      ],
    },
  }),
  updateSettings,
  on: () => () => undefined,
  relistOffer,
};

const state = {
  paired: true,
  panelVisible: true,
  settings: { hiddenContracts: ['c'] },
} as unknown as AppState;

describe('Moje — zakończone (0.3.4)', () => {
  it('pokazuje zakończone, pomija schowane; usunięcie wymaga potwierdzenia', async () => {
    const onOpen = vi.fn();
    render(<MyContracts state={state} onOpen={onOpen} />);
    expect(await screen.findByText('Zakończone')).toBeTruthy();
    expect(screen.getByText('Stara oferta')).toBeTruthy();
    expect(screen.queryByText('Schowana')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Usuń' }));
    expect(updateSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń' }));
    expect(updateSettings).toHaveBeenCalledWith({ hiddenContracts: ['c', 'b'] });
  });

  it('„Wystaw ponownie” tworzy nową ofertę i ją otwiera', async () => {
    const onOpen = vi.fn();
    render(<MyContracts state={state} onOpen={onOpen} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Wystaw ponownie' }));
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith('new'));
    expect(relistOffer).toHaveBeenCalledWith('b');
  });
});
