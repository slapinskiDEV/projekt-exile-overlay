import type { AppState } from '@shared/ipc';
import { useApi } from '../lib/hooks';
import { LoginRequired } from '../components/common';
import { ContractRow } from './ContractRow';

const ROLE_LABELS = { issuer: 'Moja prośba', helper: 'Pomagam', applicant: 'Zgłoszony' } as const;

export function MyContracts({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const { data, error, loading } = useApi(() => window.overlay.me(), [], {
    refreshMs: 30_000,
    enabled: state.paired && state.panelVisible,
  });

  if (!state.paired) return <LoginRequired />;

  return (
    <div className="stack">
      {data && (
        <div className="card spread">
          <span className="pixel" style={{ fontSize: 20 }}>
            {data.profile.displayName ?? 'Gracz'}
          </span>
          <span className="row">
            <span className="badge">poz. {data.profile.level}</span>
            <span className="badge gold">{data.profile.reputation} RP</span>
          </span>
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && data.contracts.length === 0 && <p className="muted">Nie masz otwartych próśb ani zgłoszeń.</p>}
      <div className="list">
        {data?.contracts.map((contract) => (
          <ContractRow key={`${contract.role}-${contract.id}`} contract={contract} onOpen={onOpen} extra={ROLE_LABELS[contract.role]} />
        ))}
      </div>
    </div>
  );
}
