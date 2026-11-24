import { useMemo, useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useAction } from '../lib/hooks';
import { useCategories } from '../lib/categories';
import { CONTRACT_URL, REQUEST_CATEGORIES } from '../lib/format';
import { ItemCard } from '../components/ItemCard';
import { LoginRequired } from '../components/common';

/**
 * „Poproś o pomoc” (Alt+P) i „Zapytaj o przedmiot” (Alt+C, z kartą przedmiotu).
 * Obszar i poziom są wypełnione z logu gry — gracz może je poprawić albo usunąć.
 */
export function RequestForm({
  state,
  initialCategory,
  itemText,
  onBack,
  onOpenContract,
}: {
  state: AppState;
  initialCategory?: string;
  itemText: string | null;
  onBack: () => void;
  onOpenContract: (id: string) => void;
}) {
  const apiCategories = useCategories();
  const categories = useMemo(() => {
    const labels = new Map(apiCategories.map((c) => [c.id, c.label]));
    const offered = REQUEST_CATEGORIES.filter((c) => apiCategories.length === 0 || labels.has(c.id));
    return offered.map((c) => ({ id: c.id, label: labels.get(c.id) ?? c.label }));
  }, [apiCategories]);

  const [categoryId, setCategoryId] = useState(initialCategory ?? (itemText ? 'crafting' : 'boss_carry'));
  const [text, setText] = useState('');
  const [area, setArea] = useState(state.area?.name ?? '');
  const [areaLevel, setAreaLevel] = useState(state.area?.level ? String(state.area.level) : '');
  const nick = state.settings.nick.trim();
  const [withNick, setWithNick] = useState(Boolean(nick));
  const [createdId, setCreatedId] = useState<string | null>(null);
  const action = useAction();

  if (!state.paired) {
    return (
      <div className="stack">
        <button className="ghost" onClick={onBack}>
          ← Wróć
        </button>
        <h2>{itemText || initialCategory === 'crafting' ? 'Zapytaj o przedmiot' : 'Poproś o pomoc'}</h2>
        <LoginRequired />
      </div>
    );
  }

  if (createdId) {
    return (
      <div className="stack">
        <h2>Prośba wysłana</h2>
        <p className="success">Prośba jest już widoczna na stronie i w overlayach innych graczy.</p>
        <div className="row">
          <button className="primary" onClick={() => onOpenContract(createdId)}>
            Pokaż prośbę
          </button>
          <button onClick={() => void window.overlay.openExternal(CONTRACT_URL(createdId))}>Otwórz na stronie</button>
          <button className="ghost" onClick={onBack}>
            Wróć do listy
          </button>
        </div>
      </div>
    );
  }

  const level = areaLevel.trim() ? Number.parseInt(areaLevel, 10) : null;
  const levelValid = level === null || (Number.isInteger(level) && level >= 1 && level <= 100);
  const canSend = text.trim().length >= 3 && levelValid && !action.pending;

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
      }),
    );
    if (result) setCreatedId(result.id);
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) void submit();
      }}
    >
      <button type="button" className="ghost" onClick={onBack}>
        ← Wróć
      </button>
      <h2>{itemText ? 'Zapytaj o przedmiot' : 'Poproś o pomoc'}</h2>
      {itemText && <ItemCard text={itemText} onCopy={(t) => window.overlay.copyText(t)} />}
      <div className="field">
        <label htmlFor="req-category">Kategoria</label>
        <select id="req-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="req-text">W czym pomóc? (jedno zdanie)</label>
        <input
          id="req-text"
          type="text"
          autoFocus
          maxLength={200}
          value={text}
          placeholder={itemText ? 'Np. Co dalej craftować na tej zbroi?' : 'Np. Potrzebuję pomocy z bossem aktu 2'}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 3, marginBottom: 0 }}>
          <label htmlFor="req-area">Obszar</label>
          <input id="req-area" type="text" maxLength={120} value={area} onChange={(e) => setArea(e.target.value)} />
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
      {!levelValid && <p className="error">Poziom obszaru to liczba od 1 do 100.</p>}
      <p className="small muted">Liga: {state.settings.league ?? 'nie wybrano (ustaw w ustawieniach)'}</p>
      {nick && (
        <label className="checkbox">
          <input type="checkbox" checked={withNick} onChange={(e) => setWithNick(e.target.checked)} />
          Dopisz nick postaci ({nick}), żeby pomocnik mógł napisać w grze
        </label>
      )}
      {action.error && <p className="error">{action.error}</p>}
      <button type="submit" className="primary" disabled={!canSend}>
        {action.pending ? 'Wysyłanie…' : 'Wyślij prośbę'}
      </button>
    </form>
  );
}
