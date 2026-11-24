import { useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useApi } from '../lib/hooks';
import { useCategories } from '../lib/categories';
import { ContractRow } from './ContractRow';

/** Lista otwartych próśb — kolejność od serwera: ten obszar → poziom ±5 → reszta. */
export function ContractList({
  state,
  onOpen,
  onRequest,
}: {
  state: AppState;
  onOpen: (id: string) => void;
  onRequest: () => void;
}) {
  const categories = useCategories();
  const [category, setCategory] = useState('');
  const league = state.settings.league;
  const area = state.area?.name ?? null;
  const areaLevel = state.area?.level ?? null;

  const { data, error, loading, reload } = useApi(
    () => window.overlay.contracts({ league, category: category || null, area, areaLevel }),
    [league, category, area, areaLevel],
    { refreshMs: 30_000, enabled: state.panelVisible },
  );

  return (
    <div className="stack">
      <div className="row">
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }} aria-label="Kategoria">
          <option value="">Wszystkie kategorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button onClick={() => void reload()} disabled={loading} title="Odśwież">
          ↻
        </button>
        <button className="primary" onClick={onRequest}>
          Poproś
        </button>
      </div>
      {error && <p className="error">{error.message}</p>}
      {!error && data && data.contracts.length === 0 && (
        <p className="muted">Brak otwartych próśb{league ? ` w lidze ${league}` : ''}. Może ktoś potrzebuje pomocy za chwilę.</p>
      )}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      <div className="list">
        {data?.contracts.map((contract) => <ContractRow key={contract.id} contract={contract} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
