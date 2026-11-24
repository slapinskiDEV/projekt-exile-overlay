import type { AppState } from '@shared/ipc';
import { useApi } from '../lib/hooks';
import { timeAgo } from '../lib/format';

/** Pytania z działu Pomoc na forum, z tagiem ligi. */
export function ThreadList({
  state,
  onOpen,
  onAsk,
}: {
  state: AppState;
  onOpen: (id: string) => void;
  onAsk: () => void;
}) {
  const league = state.settings.league;
  const { data, error, loading } = useApi(() => window.overlay.threads(league), [league], {
    refreshMs: 30_000,
    enabled: state.panelVisible,
  });

  return (
    <div className="stack">
      <button className="primary" onClick={onAsk}>
        Zapytaj społeczność
      </button>
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && data.threads.length === 0 && <p className="muted">Brak pytań{league ? ` w lidze ${league}` : ''}.</p>}
      <div className="list">
        {data?.threads.map((thread) => (
          <button key={thread.id} className="list-item" onClick={() => onOpen(thread.id)}>
            <div className="item-title">{thread.title}</div>
            <div className="meta">
              <span>{thread.authorName ?? 'Gracz'}</span>
              <span>{timeAgo(thread.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
