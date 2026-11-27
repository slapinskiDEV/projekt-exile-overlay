// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AppState } from '@shared/ipc';
import { RequestForm } from '../renderer/src/overlay/RequestForm';

afterEach(cleanup);

const state = {
  paired: true,
  settings: { league: 'Dawn', nick: '', shortcuts: {} },
  area: { name: 'Przejście Zdrajcy', level: 22 },
} as unknown as AppState;

(window as unknown as { overlay: unknown }).overlay = new Proxy({} as Record<string, unknown>, {
  get: () => () => new Promise(() => {}),
});

/** 0.3.0 — rodzaj wynika z przycisku na liście; formularz nie pyta o niego drugi raz. */
describe('RequestForm', () => {
  it('„Zaoferuj pomoc” otwiera ofertę bez ponownego wyboru rodzaju', () => {
    render(<RequestForm state={state} itemText={null} initialOffer onBack={() => {}} onOpenContract={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Zaoferuj pomoc' })).toBeTruthy();
    expect(screen.queryByText('Potrzebuję pomocy')).toBeNull();
    expect(screen.getByText('Ile osób zabierzesz?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wystaw ofertę' })).toBeTruthy();
  });

  it('prośba nie pyta o miejsca; link zmienia rodzaj w razie pomyłki', () => {
    render(<RequestForm state={state} itemText={null} onBack={() => {}} onOpenContract={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Poproś o pomoc' })).toBeTruthy();
    expect(screen.queryByText('Ile osób zabierzesz?')).toBeNull();
    fireEvent.click(screen.getByText('Chcę jednak zaoferować pomoc'));
    expect(screen.getByRole('heading', { name: 'Zaoferuj pomoc' })).toBeTruthy();
  });

  it('płatna bez waluty nie daje się wysłać i mówi dlaczego', () => {
    render(<RequestForm state={state} itemText={null} onBack={() => {}} onOpenContract={() => {}} />);
    fireEvent.change(screen.getByLabelText('Czego potrzebujesz?'), { target: { value: 'Pomoc z bossem' } });
    expect((screen.getByRole('button', { name: 'Wyślij prośbę' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('Za currency'));
    expect(screen.getByText('Wybierz walutę albo zaznacz „Darmowo”.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Wyślij prośbę' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
