import { useMemo, useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useAction } from '../lib/hooks';
import { useCategories } from '../lib/categories';
import { CONTRACT_URL, REQUEST_CATEGORIES } from '../lib/format';
import { ItemCard } from '../components/ItemCard';
import { LoginRequired } from '../components/common';
import { PaymentDisclaimer } from '../components/Payment';
import { useApi } from '../lib/hooks';

const COPY = {
  request: {
    icon: '🙋',
    title: 'Poproś o pomoc',
    lead: 'Opisz, czego potrzebujesz. Gracze zgłoszą się, a Ty wybierzesz pomocnika.',
    textLabel: 'Czego potrzebujesz?',
    placeholder: 'Np. Pomóżcie zabić bossa aktu 2',
    submit: 'Wyślij prośbę',
    switchTo: 'Chcę jednak zaoferować pomoc',
    paymentHint: 'Dopłata dla każdego pomocnika.',
  },
  offer: {
    icon: '🛡️',
    title: 'Zaoferuj pomoc',
    lead: 'Gracze dołączają jak do party — bez czekania na akceptację. Ty decydujesz, kiedy ruszacie.',
    textLabel: 'W czym pomożesz?',
    placeholder: 'Np. Pomogę zabić Arbitra',
    submit: 'Wystaw ofertę',
    switchTo: 'Chcę jednak poprosić o pomoc',
    paymentHint: 'Cena od każdej osoby, która dołączy.',
  },
} as const;

/**
 * „Poproś o pomoc” (Alt+P), „Zaoferuj pomoc” (Alt+O) i „Zapytaj o przedmiot” (Alt+C, z kartą
 * przedmiotu). Rodzaj wynika z przycisku, którym gracz tu trafił (0.3.0) — formularz
 * nie pyta o to drugi raz. Obszar i poziom są wypełnione z logu gry.
 */
export function RequestForm({
  state,
  initialCategory,
  itemText,
  initialOffer = false,
  onBack,
  onOpenContract,
}: {
  state: AppState;
  initialCategory?: string;
  itemText: string | null;
  /** Oferta pomocy zamiast prośby (spec 0192 serwisu). */
  initialOffer?: boolean;
  onBack: () => void;
  onOpenContract: (id: string) => void;
}) {
  const apiCategories = useCategories();
  // Te same kategorie co na stronie (0.2.2); lista wbudowana tylko, gdy API nie odpowiada.
  const categories = useMemo(
    () => (apiCategories.length > 0 ? apiCategories : REQUEST_CATEGORIES),
    [apiCategories],
  );

  const [categoryId, setCategoryId] = useState(initialCategory ?? (itemText ? 'crafting' : 'boss_carry'));
  const [text, setText] = useState('');
  // Obszar i poziom idą za grą (0.3.2): przejście do innej lokacji z otwartym formularzem
  // aktualizuje oba pola naraz. Dopiero ręczna zmiana zatrzymuje podążanie — wtedy
  // stara nazwa nie zostaje z poziomem nowej lokacji ani odwrotnie.
  const gameArea = state.area?.name ?? '';
  const gameLevel = state.area?.level ? String(state.area.level) : '';
  const [manualArea, setManualArea] = useState<{ name: string; level: string } | null>(null);
  const area = manualArea?.name ?? gameArea;
  const areaLevel = manualArea?.level ?? gameLevel;
  const setArea = (name: string) => setManualArea({ name, level: areaLevel });
  const setAreaLevel = (level: string) => setManualArea({ name: area, level });
  const differsFromGame = manualArea !== null && Boolean(gameArea) && (area !== gameArea || areaLevel !== gameLevel);
  const nick = state.settings.nick.trim();
  const [withNick, setWithNick] = useState(Boolean(nick));
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [offer, setOffer] = useState(initialOffer && !itemText);
  const [slots, setSlots] = useState(3);
  const [paid, setPaid] = useState(false);
  const [currency, setCurrency] = useState('');
  const [amount, setAmount] = useState('1');
  const action = useAction();
  const currencies = useApi(() => window.overlay.currencies('poe2'), [], { enabled: state.paired });
  const selectedCurrency = currencies.data?.currencies.find((c) => c.id === currency) ?? null;
  const copy = COPY[offer ? 'offer' : 'request'];
  const title = itemText ? 'Zapytaj o przedmiot' : copy.title;

  if (!state.paired) {
    return (
      <div className="stack">
        <BackButton onBack={onBack} />
        <h2>{itemText || initialCategory === 'crafting' ? 'Zapytaj o przedmiot' : copy.title}</h2>
        <LoginRequired />
      </div>
    );
  }

  if (createdId) {
    return (
      <div className="done-card">
        <div className="done-icon" aria-hidden>
          ✓
        </div>
        <h2>{offer ? 'Oferta wystawiona!' : 'Prośba wysłana!'}</h2>
        <p className="muted">
          {offer ? 'Oferta' : 'Prośba'} jest już widoczna na stronie, na Discordzie i w overlayach innych graczy.
          Dostaniesz powiadomienie, gdy ktoś {offer ? 'dołączy' : 'się zgłosi'}.
        </p>
        <div className="stack-tight">
          <button className="primary wide" onClick={() => onOpenContract(createdId)}>
            {offer ? 'Pokaż ofertę' : 'Pokaż prośbę'}
          </button>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button onClick={() => void window.overlay.openExternal(CONTRACT_URL(createdId))}>Otwórz na stronie</button>
            <button className="ghost" onClick={onBack}>
              Wróć do listy
            </button>
          </div>
        </div>
      </div>
    );
  }

  const level = areaLevel.trim() ? Number.parseInt(areaLevel, 10) : null;
  const levelValid = level === null || (Number.isInteger(level) && level >= 1 && level <= 100);
  const amountNumber = Number.parseInt(amount, 10);
  const withPayment = paid && Boolean(currency);
  const amountValid = !withPayment || (Number.isInteger(amountNumber) && amountNumber >= 1 && amountNumber <= 9999);
  const textValid = text.trim().length >= 3;
  const canSend = textValid && levelValid && amountValid && (!paid || Boolean(currency)) && !action.pending;
  const rp = paid ? 1 : 2;

  const submit = async () => {
    const sentence = withNick && nick ? `${text.trim()} (nick w grze: ${nick})` : text.trim();
    const result = await action.run(() =>
      window.overlay.createContract({
        categoryId,
        text: sentence,
        league: state.settings.league,
        area: area.trim() || null,
        areaLevel: level,
        itemText: itemText ?? null,
        kind: offer ? 'offer' : 'request',
        slots: offer ? slots : undefined,
        paymentCurrency: withPayment ? currency : null,
        paymentAmount: withPayment ? amountNumber : null,
      }),
    );
    if (result) setCreatedId(result.id);
  };

  return (
    <form
      className={`request-form ${offer ? 'offer' : 'request'}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) void submit();
      }}
    >
      <BackButton onBack={onBack} />

      <div className={`form-hero ${offer ? 'offer' : 'request'}`}>
        <span className="form-hero-icon" aria-hidden>
          {itemText ? '💎' : copy.icon}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{itemText ? 'Zapytaj innych graczy, co zrobić z tym przedmiotem.' : copy.lead}</p>
          {!itemText && (
            <button type="button" className="link small" onClick={() => setOffer(!offer)}>
              {copy.switchTo}
            </button>
          )}
        </div>
      </div>

      {itemText && <ItemCard text={itemText} onCopy={(t) => window.overlay.copyText(t)} />}

      <section className="form-section">
        <h3>
          <span className="step">1</span> Co?
        </h3>
        <div className="field">
          <label htmlFor="req-text">{itemText ? 'Twoje pytanie' : copy.textLabel}</label>
          <input
            id="req-text"
            type="text"
            autoFocus
            maxLength={200}
            value={text}
            placeholder={itemText ? 'Np. Co dalej craftować na tej zbroi?' : copy.placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="field-foot">
            <span>{textValid ? 'Jedno zdanie wystarczy.' : 'Minimum 3 znaki.'}</span>
            <span>{text.length}/200</span>
          </div>
        </div>
        <div className="field">
          <span className="label">Kategoria</span>
          <div className="chips" role="radiogroup" aria-label="Kategoria">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                className={`chip ${categoryId === c.id ? 'active' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>
          <span className="step">2</span> {offer ? 'Gdzie i z kim?' : 'Gdzie?'}
        </h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 3, marginBottom: 0 }}>
            <label htmlFor="req-area">Obszar {state.area?.name && <span className="hint">· z gry</span>}</label>
            <input
              id="req-area"
              type="text"
              maxLength={120}
              value={area}
              placeholder="Np. Przejście Zdrajcy"
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="req-level">Poziom</label>
            <input
              id="req-level"
              type="number"
              min={1}
              max={100}
              value={areaLevel}
              onChange={(e) => setAreaLevel(e.target.value)}
            />
          </div>
        </div>
        {differsFromGame && (
          <button type="button" className="link area-sync" onClick={() => setManualArea(null)}>
            ↺ Wpisz obszar z gry: {gameArea}
            {gameLevel ? ` · ${gameLevel} lvl` : ''}
          </button>
        )}
        {!levelValid && <p className="error">Poziom obszaru to liczba od 1 do 100.</p>}
        {offer && (
          <div className="field" style={{ marginTop: 12 }}>
            <span className="label">Ile osób zabierzesz?</span>
            <div className="chips" role="radiogroup" aria-label="Miejsca">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={slots === n}
                  className={`chip square ${slots === n ? 'active' : ''}`}
                  onClick={() => setSlots(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {nick && (
          <label className="checkbox" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={withNick} onChange={(e) => setWithNick(e.target.checked)} />
            <span>
              Dopisz nick postaci <strong>{nick}</strong>, żeby można było napisać w grze
            </span>
          </label>
        )}
      </section>

      <section className="form-section">
        <h3>
          <span className="step">3</span> Zapłata
        </h3>
        <div className="pay-toggle" role="radiogroup" aria-label="Zapłata">
          <button type="button" role="radio" aria-checked={!paid} className={!paid ? 'active' : ''} onClick={() => setPaid(false)}>
            <strong>Darmowo</strong>
            <span>2 RP za pomoc</span>
          </button>
          <button type="button" role="radio" aria-checked={paid} className={paid ? 'active' : ''} onClick={() => setPaid(true)}>
            <strong>Za currency</strong>
            <span>1 RP · płatne w grze</span>
          </button>
        </div>
        {paid && (
          <>
            <div className="row" style={{ marginTop: 10 }}>
              {selectedCurrency && <img src={selectedCurrency.iconUrl} alt="" width={28} height={28} />}
              <select
                value={currency}
                aria-label="Waluta"
                onChange={(e) => setCurrency(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Wybierz walutę…</option>
                {currencies.data?.currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Ilość"
                min={1}
                max={9999}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: 84 }}
              />
            </div>
            <p className={`small ${currency ? 'muted' : 'warn'}`} style={{ marginTop: 6 }}>
              {currency ? copy.paymentHint : 'Wybierz walutę albo zaznacz „Darmowo”.'}
            </p>
            {!amountValid && <p className="error">Ilość to liczba od 1 do 9999.</p>}
            <PaymentDisclaimer />
          </>
        )}
      </section>

      <div className="form-footer">
        <div className="summary">
          <span className="badge">{categories.find((c) => c.id === categoryId)?.label ?? 'Kategoria'}</span>
          {offer && <span className="badge">{slots} miejsc</span>}
          <span className="badge gold">{rp} RP</span>
          <span className="muted small">Liga: {state.settings.league ?? 'nie wybrano'}</span>
        </div>
        {action.error && <p className="error">{action.error}</p>}
        <button type="submit" className="primary wide big" disabled={!canSend}>
          {action.pending ? 'Wysyłanie…' : itemText ? 'Wyślij pytanie' : copy.submit}
        </button>
      </div>
    </form>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="ghost back" onClick={onBack}>
      ← Wróć
    </button>
  );
}
