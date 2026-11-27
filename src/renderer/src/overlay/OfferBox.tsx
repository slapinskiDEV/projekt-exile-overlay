import { useState } from 'react';
import type { ApiResult } from '@shared/ipc';
import type { ContractDetailResponse, ProblemReportRequest } from '@shared/api-types';
import { LoginRequired } from '../components/common';

type Perform = <T>(fn: () => Promise<ApiResult<T>>, success: string) => Promise<boolean>;

/**
 * Oferta pomocy (spec 0192 serwisu): „Dołącz / Wyjdź” jak w party, a dla autora
 * „Zaczynamy”, „Wykonane” z listą obecnych, zamknięcie i „Wystaw ponownie”.
 */
export function OfferBox({
  contract,
  applications,
  me,
  paired,
  pending,
  perform,
}: {
  contract: ContractDetailResponse['contract'];
  applications: ContractDetailResponse['applications'];
  me: string | null;
  paired: boolean;
  pending: boolean;
  perform: Perform;
}) {
  const joined = applications.filter((a) => a.status === 'accepted');
  const mine = me !== null && contract.issuer.id === me;
  const myEntry = applications.find((a) => a.applicantId === me);
  const inOffer = myEntry?.status === 'accepted';
  const free = contract.maxHelpers - joined.length;
  const status = contract.status;
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');

  const result = (value: string | null) =>
    value === 'confirmed' ? 'potwierdził' : value === 'problem' ? 'zgłosił problem' : value === 'awaiting' ? 'czeka na potwierdzenie' : '';

  return (
    <div className="card stack">
      <strong>
        Uczestnicy {joined.length}/{contract.maxHelpers}
      </strong>
      {joined.length === 0 && <p className="small muted">Nikt jeszcze nie dołączył.</p>}
      {joined.map((p) => (
        <div key={p.id} className="spread">
          {mine && choosing ? (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(p.applicantId)}
                onChange={(e) =>
                  setSelected((list) => (e.target.checked ? [...list, p.applicantId] : list.filter((id) => id !== p.applicantId)))
                }
              />
              {p.applicantName ?? 'Gracz'}
            </label>
          ) : (
            <span>{p.applicantName ?? 'Gracz'}</span>
          )}
          <span className="row">
            <span className="small muted">{result(p.offerResult)}</span>
            {mine && status === 'open' && (
              <button
                className="ghost"
                disabled={pending}
                title="Usuń z oferty"
                onClick={() => perform(() => window.overlay.removeFromOffer(contract.id, p.applicantId), 'Gracz usunięty z oferty.')}
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}

      {/* Gracz */}
      {!mine && status === 'open' && !paired && <LoginRequired />}
      {!mine && status === 'open' && paired && (
        <div className="row">
          {inOffer ? (
            <button className="danger" disabled={pending} onClick={() => perform(() => window.overlay.leaveOffer(contract.id), 'Wyszedłeś z oferty.')}>
              Wyjdź
            </button>
          ) : myEntry?.status === 'rejected' ? (
            <p className="small error">Autor usunął Cię z tej oferty.</p>
          ) : (
            <button
              className="primary"
              disabled={pending || free <= 0}
              onClick={() => perform(() => window.overlay.joinOffer(contract.id), 'Dołączono. Autor dostanie powiadomienie.')}
            >
              {free > 0 ? 'Dołącz' : 'Brak miejsc'}
            </button>
          )}
        </div>
      )}
      {!mine && status === 'completed' && myEntry?.offerResult === 'awaiting' && (
        <div className="stack">
          <p className="small">Autor oznaczył ofertę jako wykonaną. Potwierdź pomoc albo zgłoś problem niżej.</p>
          <button className="primary" disabled={pending} onClick={() => perform(() => window.overlay.confirmOffer(contract.id), 'Potwierdzono. Dziękujemy!')}>
            Potwierdzam
          </button>
        </div>
      )}

      {/* Autor */}
      {mine && status === 'open' && (
        <button className="primary" disabled={pending || joined.length === 0} onClick={() => perform(() => window.overlay.startOffer(contract.id), 'Zaczynamy!')}>
          Zaczynamy
        </button>
      )}
      {mine && status === 'in_progress' && !choosing && (
        <button
          className="primary"
          onClick={() => {
            setSelected(joined.map((p) => p.applicantId));
            setChoosing(true);
          }}
        >
          Wykonane
        </button>
      )}
      {mine && status === 'in_progress' && choosing && (
        <div className="row">
          <button
            className="primary"
            disabled={pending || selected.length === 0}
            onClick={async () => {
              if (await perform(() => window.overlay.completeOffer(contract.id, selected), 'Wysłano prośby o potwierdzenie.')) setChoosing(false);
            }}
          >
            Potwierdź obecnych ({selected.length})
          </button>
          <button className="ghost" onClick={() => setChoosing(false)}>
            Wróć
          </button>
        </div>
      )}
      {mine && ['open', 'in_progress', 'completed'].includes(status) && (
        <div className="stack">
          {closing ? (
            <>
              {status !== 'completed' && (
                <input type="text" maxLength={500} placeholder="Powód (opcjonalnie)" value={reason} onChange={(e) => setReason(e.target.value)} />
              )}
              <div className="row">
                <button
                  className="danger"
                  disabled={pending}
                  onClick={() =>
                    perform(
                      () => window.overlay.close(contract.id, reason.trim() || undefined),
                      status === 'completed' ? 'Oferta zamknięta.' : 'Oferta odwołana.',
                    )
                  }
                >
                  {status === 'completed' ? 'Zamknij teraz' : 'Odwołaj teraz'}
                </button>
                <button className="ghost" onClick={() => setClosing(false)}>
                  Anuluj
                </button>
              </div>
            </>
          ) : (
            <button className="danger" onClick={() => setClosing(true)}>
              {status === 'completed' ? 'Zamknij ofertę' : 'Odwołaj ofertę'}
            </button>
          )}
          {status === 'completed' && (
            <p className="small muted">RP dostajesz od tych, którzy potwierdzili. Oferta zamknie się sama po 7 dniach.</p>
          )}
        </div>
      )}
      {mine && ['completed', 'verified', 'cancelled', 'expired'].includes(status) && (
        <button disabled={pending} onClick={() => perform(() => window.overlay.relistOffer(contract.id), 'Wystawiono ofertę ponownie.')}>
          Wystaw ponownie
        </button>
      )}
    </div>
  );
}

const REASONS: Array<{ id: ProblemReportRequest['reason']; label: string }> = [
  { id: 'no_payment', label: 'Brak zapłaty' },
  { id: 'no_service', label: 'Brak usługi' },
  { id: 'other', label: 'Inny problem' },
];

/** „Zgłoś problem” — trafia do moderacji, bez gwarancji zwrotu. */
export function ProblemBox({
  pending,
  onReport,
}: {
  pending: boolean;
  onReport: (reason: ProblemReportRequest['reason'], description: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProblemReportRequest['reason']>('no_payment');
  const [description, setDescription] = useState('');
  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        Zgłoś problem
      </button>
    );
  }
  return (
    <div className="card stack">
      <strong>Zgłoś problem</strong>
      <select value={reason} onChange={(e) => setReason(e.target.value as ProblemReportRequest['reason'])} aria-label="Powód">
        {REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        maxLength={1000}
        placeholder="Co się stało? (nick w grze, godzina)"
        onChange={(e) => setDescription(e.target.value)}
      />
      <p className="small muted">
        Moderacja może pomóc wyjaśnić sprawę w rozmowie, ale serwis nie pośredniczy w zapłacie i nie gwarantuje zwrotu.
      </p>
      <div className="row">
        <button
          className="danger"
          disabled={pending || description.trim().length < 10}
          onClick={async () => {
            if (await onReport(reason, description.trim())) {
              setDescription('');
              setOpen(false);
            }
          }}
        >
          Wyślij zgłoszenie
        </button>
        <button className="ghost" onClick={() => setOpen(false)}>
          Anuluj
        </button>
      </div>
    </div>
  );
}
