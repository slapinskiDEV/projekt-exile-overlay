import { useState } from 'react';
import type { ApiResult, AppState } from '@shared/ipc';
import type { ContractDetailResponse } from '@shared/api-types';
import { useAction, useApi } from '../lib/hooks';
import { CONTRACT_URL, STATUS_LABELS, areaLabel, timeAgo } from '../lib/format';
import { ItemCard } from '../components/ItemCard';
import { LoginRequired } from '../components/common';
import { PaymentChip, PaymentDisclaimer } from '../components/Payment';
import { OfferActions, OfferParticipants, ProblemBox, offerHasAction } from './OfferBox';

const ACTIVE = new Set(['open', 'taken', 'in_progress']);

export function ContractDetail({ id, state, onBack }: { id: string; state: AppState; onBack: () => void }) {
  // Otwarty kontrakt: zdarzenie od drugiej strony przeładowuje od razu, a zapasowo
  // co 10 s (0.3.4; wcześniej 30 s, bez reakcji na powiadomienia).
  const { data, error, loading, reload } = useApi(() => window.overlay.contract(id), [id], {
    refreshMs: 10_000,
    enabled: state.panelVisible,
    contractId: id,
  });

  return (
    <div className="detail">
      <div className="detail-bar">
        <button className="ghost" onClick={onBack}>
          ← Wróć
        </button>
        <button className="ghost" onClick={() => void window.overlay.openExternal(CONTRACT_URL(id))}>
          Otwórz na stronie ↗
        </button>
      </div>
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && <Detail data={data} state={state} reload={reload} />}
    </div>
  );
}

type SubTab = 'about' | 'people' | 'chat';

function Fact({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <span className="fact-label">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <span className="fact-value">{children}</span>
    </div>
  );
}

/**
 * Podgląd kontraktu (0.3.6): nagłówek z czterema najważniejszymi faktami, blok
 * „Twój ruch” z jedną główną akcją i podzakładki Opis / Uczestnicy / Rozmowa —
 * zamiast jednej długiej ściany informacji.
 */
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
  const [tab, setTab] = useState<SubTab>('about');
  const canWrite = state.paired && Boolean(mine || (offer ? participant : myApplication));
  const peopleCount = offer ? accepted.length : applications.length;
  const hasAction = offer ? offerHasAction(contract, applications, me) : active || Boolean(myApplication);

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
      <section className={`detail-hero ${offer ? 'offer' : 'request'}`}>
        <div className="row tight">
          <span className={`kind-tag ${offer ? 'offer' : 'request'}`}>{offer ? 'Oferta' : 'Prośba'}</span>
          <span className="badge">{contract.categoryLabel}</span>
          <span className={`badge ${active ? 'green' : ''}`}>{STATUS_LABELS[contract.status]}</span>
        </div>
        <h2 className="detail-title">{contract.title}</h2>
        <div className="facts">
          <Fact icon="📍" label="Gdzie">
            {where ?? 'dowolnie'}
            {contract.league && <span className="muted"> · {contract.league}</span>}
          </Fact>
          <Fact icon="👤" label={offer ? 'Oferuje' : 'Prosi'}>
            {contract.issuer.name ?? 'Gracz'} <span className="muted">· {timeAgo(contract.createdAt)}</span>
          </Fact>
          <Fact icon="👥" label={offer ? 'Miejsca' : 'Pomocnicy'}>
            {contract.helpersCount}/{contract.maxHelpers}
          </Fact>
          <Fact icon="🏆" label="Nagroda">
            <span className="rp">{contract.rpValue} RP</span> {contract.payment && <PaymentChip payment={contract.payment} />}
          </Fact>
        </div>
      </section>

      {(action.error || notice) && (
        <div className={`notice ${action.error ? 'error' : 'success'}`} role="status">
          {action.error ?? notice}
        </div>
      )}

      <section className="next-step">
        <h3 className="section-label">Twój ruch</h3>
        {!hasAction && (
          <p className="step-hint">
            {STATUS_LABELS[contract.status]} — możesz już tylko przejrzeć szczegóły.
          </p>
        )}
        {offer && (
          <OfferActions
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
          <div className="spread">
            <span>
              Twoje zgłoszenie: <strong>{myApplication.status === 'accepted' ? 'przyjęte ✓' : 'czeka na decyzję ⏳'}</strong>
            </span>
            {active && (
              <button
                className="ghost"
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
            onShowApplications={() => setTab('people')}
          />
        )}
      </section>

      <div className="subtabs" role="tablist" aria-label="Szczegóły kontraktu">
        {(
          [
            ['about', 'Opis', null],
            ['people', offer ? 'Uczestnicy' : 'Zgłoszenia', peopleCount],
            ['chat', 'Rozmowa', messages.length],
          ] as const
        ).map(([key, label, count]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
            {count !== null && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <section className="tab-body stack">
          {contract.description ? <p className="content">{contract.description}</p> : <p className="muted">Bez opisu.</p>}
          {contract.itemText && <ItemCard text={contract.itemText} onCopy={(t) => window.overlay.copyText(t)} />}
          {contract.payment && <PaymentDisclaimer />}
          {canReport && (
            <div className="problem-row">
              <ProblemBox
                pending={action.pending}
                onReport={(reason, description) =>
                  perform(() => window.overlay.reportProblem(contract.id, { reason, description }), 'Zgłoszenie wysłane do moderacji.')
                }
              />
            </div>
          )}
        </section>
      )}

      {tab === 'people' && (
        <section className="tab-body">
          {offer ? (
            <OfferParticipants contract={contract} applications={applications} me={me} pending={action.pending} perform={perform} />
          ) : applications.length === 0 ? (
            <p className="muted">Nikt się jeszcze nie zgłosił.</p>
          ) : (
            <div className="people">
              {applications.map((application) => (
                <div key={application.id} className="person column">
                  <div className="spread">
                    <span className="person-name">{application.applicantName ?? 'Gracz'}</span>
                    <span className="row tight">
                      <span className="small muted">
                        {applicationStatus(application.status)} · {timeAgo(application.createdAt)}
                      </span>
                      {mine && active && application.status === 'pending' && (
                        <button
                          className="primary small-button"
                          disabled={action.pending}
                          onClick={() => perform(() => window.overlay.acceptApplication(application.id), 'Pomocnik przyjęty.')}
                        >
                          Przyjmij
                        </button>
                      )}
                    </span>
                  </div>
                  {application.message && <div className="person-note">„{application.message}”</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'chat' && (
        <section className="tab-body stack">
          {messages.length === 0 && <p className="muted">Brak wiadomości.</p>}
          <div className="chat">
            {messages.map((message) => (
              <div key={message.id} className={`bubble ${message.authorId === me ? 'own' : ''}`}>
                <div className="who">
                  {message.authorName ?? 'Gracz'} · {timeAgo(message.createdAt)}
                </div>
                {message.content}
              </div>
            ))}
          </div>
          {canWrite ? (
            <MessageBox
              pending={action.pending}
              onSend={(content) => perform(() => window.overlay.sendMessage(contract.id, content), 'Wysłano.')}
            />
          ) : (
            <p className="small muted">Pisać mogą autor i osoby biorące udział.</p>
          )}
        </section>
      )}
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
    <div className="stack">
      <p className="step-hint">Możesz pomóc? Zgłoś się — autor wybierze pomocnika.</p>
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
  onShowApplications,
}: {
  accepted: Array<{ id: string; name: string | null }>;
  pending: boolean;
  onFinish: (helperIds: string[]) => Promise<boolean>;
  onExtend: () => Promise<boolean>;
  onClose: () => Promise<boolean>;
  onShowApplications: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => accepted.map((a) => a.id));
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <div className="stack">
      {accepted.length > 0 ? (
        <>
          <p className="step-hint">Po wszystkim zaznacz, kto faktycznie pomógł, i zakończ.</p>
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
        <p className="step-hint">
          Przyjmij pomocnika w zakładce{' '}
          <button className="link" onClick={onShowApplications}>
            Zgłoszenia
          </button>
          , żeby móc zakończyć kontrakt.
        </p>
      )}
      <div className="row secondary-actions">
        <button className="ghost" disabled={pending} onClick={() => void onExtend()}>
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
          <button className="ghost danger-text" disabled={pending} onClick={() => setConfirmClose(true)}>
            Zamknij prośbę
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
