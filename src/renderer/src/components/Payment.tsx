import type { OverlayContract } from '@shared/api-types';

/** Zapłata w grze od osoby (spec 0192 serwisu) — tylko deklaracja. */
export function PaymentChip({ payment }: { payment: OverlayContract['payment'] }) {
  if (!payment) return null;
  return (
    <span className="badge gold payment" title={`Zapłata w grze: ${payment.amount} × ${payment.name} od osoby`}>
      {payment.amount} × <img src={payment.iconUrl} alt="" /> {payment.name}
    </span>
  );
}

/** Zastrzeżenie przy zapłacie — serwis nie pośredniczy, RMT zabronione. */
/** `compact` — jedna linijka w podglądzie kontraktu (0.3.7); pełna treść w formularzu. */
export function PaymentDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="disclaimer-line" title="Projekt Exile nie pośredniczy w płatnościach i nie gwarantuje zwrotu.">
        💰 Zapłata w grze, poza serwisem · tylko currency — RMT zabronione
      </p>
    );
  }
  return (
    <div className="disclaimer">
      <p>
        Zapłata odbywa się w grze, poza serwisem. Projekt Exile nie pośredniczy w płatnościach i nie odpowiada za
        nieuczciwość graczy. W razie problemu moderacja może pomóc wyjaśnić sprawę w rozmowie, ale nie gwarantuje zwrotu.
      </p>
      <p>
        <strong>Tylko currency z gry — RMT (handel za prawdziwe pieniądze) jest całkowicie zabronione.</strong>
      </p>
    </div>
  );
}
