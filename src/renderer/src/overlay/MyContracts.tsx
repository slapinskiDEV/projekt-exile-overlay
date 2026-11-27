import { useState } from 'react';
import type { AppState } from '@shared/ipc';
import type { MeResponse } from '@shared/api-types';
import { useAction, useApi } from '../lib/hooks';
import { LoginRequired } from '../components/common';
import { ContractRow } from './ContractRow';
import { STATUS_LABELS } from '../lib/format';

const ROLE_LABELS = { issuer: 'Moja prośba', helper: 'Pomagam', applicant: 'Zgłoszony' } as const;

/** Kontrakty po zamknięciu — w „Moje” lądują w sekcji „Zakończone” (0.3.4). */
const FINISHED = new Set(['verified', 'cancelled', 'expired', 'rejected']);

type MyContract = MeResponse['contracts'][number];

function roleLabel(contract: MyContract): string {
  if (contract.role === 'issuer') return contract.kind === 'offer' ? 'Moja oferta' : ROLE_LABELS.issuer;
  return ROLE_LABELS[contract.role];
}

export function MyContracts({
  state,
  onOpen,
}: {
  state: AppState;
  onOpen: (id: string) => void;
}) {
  const { data, error, loading, reload } = useApi(() => window.overlay.me(), [], {
    refreshMs: 30_000,
    enabled: state.paired && state.panelVisible,
    contractId: '*',
  });

  if (!state.paired) return <LoginRequired />;

  const hiddenList = state.settings.hiddenContracts ?? [];
  const hidden = new Set(hiddenList);
  const contracts = data?.contracts ?? [];
  const active = contracts.filter((c) => !FINISHED.has(c.status));
  const finished = contracts.filter((c) => FINISHED.has(c.status) && c.role === 'issuer' && !hidden.has(c.id));

  return (
    <div className="stack">
      {data && (
        <div className="card spread">
          <span className="pixel" style={{ fontSize: 20 }}>
            {data.profile.displayName ?? 'Gracz'}
          </span>
          <span className="row">
            <span className="badge" title="Poziom konta w serwisie Projekt Exile">poziom konta {data.profile.level}</span>
            <span className="badge gold">{data.profile.reputation} RP</span>
          </span>
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && active.length === 0 && <p className="muted">Nie masz otwartych próśb, ofert ani zgłoszeń.</p>}
      <div className="list">
        {active.map((contract) => (
          <ContractRow key={`${contract.role}-${contract.id}`} contract={contract} onOpen={onOpen} extra={roleLabel(contract)} />
        ))}
      </div>

      {finished.length > 0 && (
        <>
          <h3>Zakończone</h3>
          <div className="list">
            {finished.map((contract) => (
              <FinishedRow
                key={contract.id}
                contract={contract}
                onOpen={onOpen}
                onHide={() => void window.overlay.updateSettings({ hiddenContracts: [...hiddenList, contract.id] })}
                onRelisted={(id) => {
                  void reload();
                  onOpen(id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Zakończony kontrakt gracza: „Wystaw ponownie” (oferta) albo „Usuń” z potwierdzeniem. */
function FinishedRow({
  contract,
  onOpen,
  onHide,
  onRelisted,
}: {
  contract: MyContract;
  onOpen: (id: string) => void;
  onHide: () => void;
  onRelisted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = useAction();

  return (
    <div className="finished-item">
      <ContractRow contract={contract} onOpen={onOpen} extra={STATUS_LABELS[contract.status]} />
      <div className="finished-actions">
        {confirming ? (
          <>
            <span className="small">Usunąć z listy? Na stronie zostaje w historii.</span>
            <button className="danger" onClick={onHide}>
              Tak, usuń
            </button>
            <button className="ghost" onClick={() => setConfirming(false)}>
              Nie
            </button>
          </>
        ) : (
          <>
            {contract.kind === 'offer' && (
              <button
                className="primary"
                disabled={action.pending}
                onClick={async () => {
                  const created = await action.run(() => window.overlay.relistOffer(contract.id));
                  if (created) onRelisted(created.id);
                }}
              >
                Wystaw ponownie
              </button>
            )}
            <button className="ghost" onClick={() => setConfirming(true)}>
              Usuń
            </button>
          </>
        )}
      </div>
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}
