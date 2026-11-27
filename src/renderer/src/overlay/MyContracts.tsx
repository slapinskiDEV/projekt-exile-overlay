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

type View = 'active' | 'issued' | 'helping' | 'finished';

const VIEWS: Array<[View, string]> = [
  ['active', 'Aktywne'],
  ['issued', 'Wystawione'],
  ['helping', 'Biorę udział'],
  ['finished', 'Zakończone'],
];

const EMPTY: Record<View, string> = {
  active: 'Nie masz otwartych próśb, ofert ani zgłoszeń.',
  issued: 'Nie masz otwartych próśb ani ofert.',
  helping: 'Nigdzie teraz nie pomagasz.',
  finished: 'Brak zakończonych kontraktów.',
};

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

  const [view, setView] = useState<View>('active');
  const [kind, setKind] = useState<'' | 'request' | 'offer'>('');

  if (!state.paired) return <LoginRequired />;

  const hiddenList = state.settings.hiddenContracts ?? [];
  const hidden = new Set(hiddenList);
  const contracts = (data?.contracts ?? []).filter((c) => !kind || c.kind === kind);
  const groups: Record<View, MyContract[]> = {
    active: contracts.filter((c) => !FINISHED.has(c.status)),
    issued: contracts.filter((c) => !FINISHED.has(c.status) && c.role === 'issuer'),
    helping: contracts.filter((c) => !FINISHED.has(c.status) && c.role !== 'issuer'),
    finished: contracts.filter((c) => FINISHED.has(c.status) && c.role === 'issuer' && !hidden.has(c.id)),
  };
  const shown = groups[view];

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

      {/* Filtry (0.3.6): widok i rodzaj. */}
      <div className="my-filters">
        <div className="chips" role="radiogroup" aria-label="Widok">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              role="radio"
              aria-checked={view === key}
              className={`chip ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              {label} <span className="count">{groups[key].length}</span>
            </button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as '' | 'request' | 'offer')} aria-label="Rodzaj">
          <option value="">Prośby i oferty</option>
          <option value="request">Tylko prośby</option>
          <option value="offer">Tylko oferty</option>
        </select>
      </div>

      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && shown.length === 0 && <p className="muted">{EMPTY[view]}</p>}
      <div className="list">
        {view === 'finished'
          ? shown.map((contract) => (
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
            ))
          : shown.map((contract) => (
              <ContractRow key={`${contract.role}-${contract.id}`} contract={contract} onOpen={onOpen} extra={roleLabel(contract)} />
            ))}
      </div>
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
