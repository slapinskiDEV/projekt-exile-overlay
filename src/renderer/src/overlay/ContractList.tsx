import { useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useApi } from '../lib/hooks';
import { useCategories } from '../lib/categories';
import { ContractRow } from './ContractRow';

const KINDS = {
  request: {
    label: 'Prośby',
    hint: 'Gracze szukają pomocy',
    ctaTitle: 'Potrzebujesz pomocy?',
    ctaText: 'Wystaw prośbę — gracze się zgłoszą.',
    ctaButton: 'Poproś o pomoc',
    empty: 'Brak otwartych próśb',
    emptyHint: 'Może ktoś poprosi za chwilę — albo zaoferuj pomoc w zakładce Oferty.',
  },
  offer: {
    label: 'Oferty',
    hint: 'Gracze oferują pomoc',
    ctaTitle: 'Chcesz pomóc innym?',
    ctaText: 'Wystaw ofertę — gracze dołączą jak do party.',
    ctaButton: 'Zaoferuj pomoc',
    empty: 'Brak otwartych ofert',
    emptyHint: 'Bądź pierwszy — zaoferuj pomoc innym.',
  },
} as const;

/**
 * Lista otwartych próśb albo ofert pomocy (spec 0192 serwisu) — kolejność od serwera:
 * ten obszar → poziom ±5 → reszta.
 */
export function ContractList({
  state,
  onOpen,
  onRequest,
}: {
  state: AppState;
  onOpen: (id: string) => void;
  onRequest: (kind: 'request' | 'offer') => void;
}) {
  const categories = useCategories();
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<'request' | 'offer'>('request');
  const [pay, setPay] = useState<'' | 'free' | 'paid'>('');
  const league = state.settings.league;
  const area = state.area?.name ?? null;
  const areaLevel = state.area?.level ?? null;
  const copy = KINDS[kind];

  const { data, error, loading, reload } = useApi(
    () =>
      window.overlay.contracts({ league, category: category || null, area, areaLevel, kind, pay: pay || null }),
    [league, category, area, areaLevel, kind, pay],
    { refreshMs: 30_000, enabled: state.panelVisible },
  );

  return (
    <div className="stack">
      <div className="kind-switch" role="tablist" aria-label="Rodzaj">
        {(['request', 'offer'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={`${k} ${kind === k ? 'active' : ''}`}
            onClick={() => setKind(k)}
          >
            <strong>{KINDS[k].label}</strong>
            <span>{KINDS[k].hint}</span>
          </button>
        ))}
      </div>

      <div className={`cta ${kind}`}>
        <div>
          <strong>{copy.ctaTitle}</strong>
          <span>{copy.ctaText}</span>
        </div>
        <button className="primary" onClick={() => onRequest(kind)}>
          {copy.ctaButton}
        </button>
      </div>

      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategoria">
          <option value="">Wszystkie kategorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={pay} onChange={(e) => setPay(e.target.value as '' | 'free' | 'paid')} aria-label="Zapłata">
          <option value="">Darmowe i płatne</option>
          <option value="free">Tylko darmowe</option>
          <option value="paid">Tylko płatne</option>
        </select>
        <button className="icon" onClick={() => void reload()} disabled={loading} title="Odśwież" aria-label="Odśwież">
          ↻
        </button>
      </div>

      {error && <p className="error">{error.message}</p>}
      {!error && data && data.contracts.length === 0 && (
        <div className="empty">
          <strong>
            {copy.empty}
            {league ? ` w lidze ${league}` : ''}
          </strong>
          <span>{copy.emptyHint}</span>
        </div>
      )}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      <div className="list">
        {data?.contracts.map((contract) => <ContractRow key={contract.id} contract={contract} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
