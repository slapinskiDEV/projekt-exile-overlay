import { useState } from 'react';
import type { ApiResult, AppState } from '@shared/ipc';
import type { ContractDetailResponse } from '@shared/api-types';
import { useAction, useApi } from '../lib/hooks';
import { CONTRACT_URL, STATUS_LABELS, areaLabel, timeAgo } from '../lib/format';
import { ItemCard } from '../components/ItemCard';
import { LoginRequired } from '../components/common';
import { PaymentChip, PaymentDisclaimer } from '../components/Payment';
import { OfferBox, ProblemBox } from './OfferBox';

const ACTIVE = new Set(['open', 'taken', 'in_progress']);

export function ContractDetail({ id, state, onBack }: { id: string; state: AppState; onBack: () => void }) {
  const { data, error, loading, reload } = useApi(() => window.overlay.contract(id), [id], {
    refreshMs: 30_000,
    enabled: state.panelVisible,
  });

  return (
    <div className="stack">
      <button className="ghost" onClick={onBack}>
        ← Wróć
      </button>
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && <Detail data={data} state={state} reload={reload} />}
    </div>
  );
}

function Detail({ data, state, reload }: { data: ContractDetailResponse; state: AppState; reload: () => Promise<void> }) {
  const { contract, applications, messages } = data;
  const me = state.settings.profile?.id ?? null;
  const mine = me !== null && contract.issuer.id === me;
  const myApplication = applications.find((a) => a.applicantId === me && a.status !== 'withdrawn' && a.status !== 'rejected');
  const active = ACTIVE.has(contract.status);
  const accepted = applications.filter((a) => a.status === 'accepted');
  const offer = contract.kind === 'offer';
  const participant = mine || myApplication?.status === 'accepted';
  const canReport = state.paired && participant && !['open', 'expired'].includes(contract.status);
  const where = areaLabel(contract.area, contract.areaLevel);
  const action = useAction();
  const [notice, setNotice] = useState<string | null>(null);

  const perform = async <T,>(fn: () => Promise<ApiResult<T>>, success: string) => {
    setNotice(null);
    const result = await action.run(fn);
    if (result === null) return false;
    setNotice(success);
    await reload();
    return true;
  };

  return (
    <>
      <div className="row">
        <span className="badge">{contract.categoryLabel}</span>
        <span className={`badge ${active ? 'green' : ''}`}>{STATUS_LABELS[contract.status]}</span>
        <span className="badge gold">{contract.rpValue} RP</span>
        {offer && <span className="badge green">Oferta</span>}
        <PaymentChip payment={contract.payment} />
      </div>
      <h2>{contract.title}</h2>
      <p className="muted small">
        {contract.issuer.name ?? 'Gracz'} · {timeAgo(contract.createdAt)}
        {where && ` · ${where}`}
        {contract.league && ` · ${contract.league}`} · {offer ? 'miejsca' : 'pomocnicy'} {contract.helpersCount}/
        {contract.maxHelpers}
      </p>
      <p className="content">{contract.description}</p>
      {contract.itemText && <ItemCard text={contract.itemText} onCopy={(t) => window.overlay.copyText(t)} />}
      <button className="link" onClick={() => void window.overlay.openExternal(CONTRACT_URL(contract.id))}>
        Otwórz na stronie
      </button>

      {contract.payment && <PaymentDisclaimer />}

      {action.error && <p className="error">{action.error}</p>}
      {notice && <p className="success">{notice}</p>}

      {offer && (
        <OfferBox
          contract={contract}
          applications={applications}
          me={me}
          paired={state.paired}
          pending={action.pending}
          perform={perform}
        />
      )}

      {!offer && !mine && active && !myApplication && (
        <ApplyBox
          paired={state.paired}
          pending={action.pending}
          onApply={(message) => perform(() => window.overlay.apply(contract.id, message || undefined), 'Zgłoszono. Zleceniodawca dostanie powiadomienie.')}
        />
      )}
      {!offer && myApplication && (
        <div className="card spread">
          <span>
            Twoje zgłoszenie: <strong>{myApplication.status === 'accepted' ? 'przyjęte' : 'czeka na decyzję'}</strong>
          </span>
          {active && (
            <button
              disabled={action.pending}
              onClick={() => perform(() => window.overlay.withdrawApplication(myApplication.id), 'Zgłoszenie wycofane.')}
            >
              Wycofaj
            </button>
          )}
        </div>
      )}

      {!offer && mine && active && (
        <OwnerActions
          accepted={accepted.map((a) => ({ id: a.applicantId, name: a.applicantName }))}
          pending={action.pending}
          onFinish={(helperIds) => perform(() => window.overlay.finish(contract.id, helperIds), 'Kontrakt zakończony, RP przyznane.')}
          onExtend={() => perform(() => window.overlay.extend(contract.id), 'Prośba przedłużona.')}
          onClose={() => perform(() => window.overlay.close(contract.id), 'Prośba zamknięta.')}
        />
      )}

      {canReport && (
        <ProblemBox
          pending={action.pending}
          onReport={(reason, description) =>
            perform(
              () => window.overlay.reportProblem(contract.id, { reason, description }),
              'Zgłoszenie wysłane do moderacji.',
            )
          }
        />
      )}

      {!offer && <h3>Zgłoszenia ({applications.length})</h3>}
      {!offer && applications.length === 0 && <p className="muted small">Nikt się jeszcze nie zgłosił.</p>}
      {!offer && applications.map((application) => (
        <div key={application.id} className="message">
          <div className="spread">
            <span className="who">
              {application.applicantName ?? 'Gracz'} · {applicationStatus(application.status)} · {timeAgo(application.createdAt)}
            </span>
            {mine && active && application.status === 'pending' && (
              <button
                disabled={action.pending}
                onClick={() => perform(() => window.overlay.acceptApplication(application.id), 'Pomocnik przyjęty.')}
              >
                Przyjmij
              </button>
            )}
          </div>
          {application.message && <div>{application.message}</div>}
        </div>
      ))}

      <h3>Rozmowa</h3>
      {messages.length === 0 && <p className="muted small">Brak wiadomości.</p>}
      {messages.map((message) => (
        <div key={message.id} className="message">
          <div className="who">
            {message.authorName ?? 'Gracz'} · {timeAgo(message.createdAt)}
          </div>
          {message.content}
        </div>
      ))}
      {state.paired && (mine || (offer ? participant : myApplication)) ? (
        <MessageBox
          pending={action.pending}
          onSend={(content) => perform(() => window.overlay.sendMessage(contract.id, content), 'Wysłano.')}
        />
      ) : null}
    </>
  );
}

function applicationStatus(status: string) {
  return status === 'accepted' ? 'przyjęty' : status === 'pending' ? 'czeka' : status === 'rejected' ? 'odrzucony' : 'wycofany';
}

function ApplyBox({ paired, pending, onApply }: { paired: boolean; pending: boolean; onApply: (message: string) => Promise<boolean> }) {
  const [message, setMessage] = useState('');
  if (!paired) return <LoginRequired />;
  return (
    <div className="card stack">
      <label htmlFor="apply-message">Wiadomość do zleceniodawcy (opcjonalnie)</label>
      <textarea id="apply-message" value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
      <button className="primary" disabled={pending} onClick={() => void onApply(message.trim())}>
        {pending ? 'Wysyłanie…' : 'Pomogę'}
      </button>
    </div>
  );
}

function OwnerActions({
  accepted,
  pending,
  onFinish,
  onExtend,
  onClose,
}: {
  accepted: Array<{ id: string; name: string | null }>;
  pending: boolean;
  onFinish: (helperIds: string[]) => Promise<boolean>;
  onExtend: () => Promise<boolean>;
  onClose: () => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string[]>(() => accepted.map((a) => a.id));
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <div className="card stack">
      <strong>Twoja prośba</strong>
      {accepted.length > 0 ? (
        <>
          <p className="small muted">Zaznacz, kto faktycznie pomógł:</p>
          {accepted.map((helper) => (
            <label key={helper.id} className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(helper.id)}
                onChange={(e) =>
                  setSelected((list) => (e.target.checked ? [...list, helper.id] : list.filter((id) => id !== helper.id)))
                }
              />
              {helper.name ?? 'Gracz'}
            </label>
          ))}
          <button className="primary" disabled={pending || selected.length === 0} onClick={() => void onFinish(selected)}>
            Zakończ i przyznaj RP
          </button>
        </>
      ) : (
        <p className="small muted">Przyjmij pomocnika ze zgłoszeń poniżej, żeby móc zakończyć kontrakt.</p>
      )}
      <div className="row">
        <button disabled={pending} onClick={() => void onExtend()}>
          Przedłuż
        </button>
        {confirmClose ? (
          <>
            <button className="danger" disabled={pending} onClick={() => void onClose()}>
              Tak, zamknij
            </button>
            <button className="ghost" onClick={() => setConfirmClose(false)}>
              Anuluj
            </button>
          </>
        ) : (
          <button className="danger" disabled={pending} onClick={() => setConfirmClose(true)}>
            Zamknij
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBox({ pending, onSend }: { pending: boolean; onSend: (content: string) => Promise<boolean> }) {
  const [content, setContent] = useState('');
  return (
    <div className="stack">
      <textarea value={content} maxLength={2000} placeholder="Napisz wiadomość…" onChange={(e) => setContent(e.target.value)} />
      <button
        disabled={pending || content.trim().length === 0}
        onClick={async () => {
          if (await onSend(content.trim())) setContent('');
        }}
      >
        Wyślij
      </button>
    </div>
  );
}
