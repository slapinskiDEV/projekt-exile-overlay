import { useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useAction } from '../lib/hooks';
import { LoginRequired } from '../components/common';

/** „Zapytaj społeczność” — wątek w dziale Pomoc z tagiem ligi. */
export function AskForm({ state, onBack, onCreated }: { state: AppState; onBack: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const action = useAction();

  const back = (
    <button type="button" className="ghost" onClick={onBack}>
      ← Wróć
    </button>
  );

  if (!state.paired) {
    return (
      <div className="stack">
        {back}
        <h2>Zapytaj społeczność</h2>
        <LoginRequired />
      </div>
    );
  }

  const canSend = title.trim().length >= 5 && content.trim().length >= 10 && !action.pending;

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSend) return;
        const result = await action.run(() =>
          window.overlay.createThread({ title: title.trim(), content: content.trim(), league: state.settings.league }),
        );
        if (result) onCreated(result.id);
      }}
    >
      {back}
      <h2>Zapytaj społeczność</h2>
      <p className="small muted">Pytanie trafi do działu Pomoc na forum{state.settings.league ? ` z tagiem ligi ${state.settings.league}` : ''}.</p>
      <div className="field">
        <label htmlFor="ask-title">Tytuł (min. 5 znaków)</label>
        <input id="ask-title" type="text" autoFocus maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ask-content">Pytanie (min. 10 znaków)</label>
        <textarea id="ask-content" rows={5} maxLength={10_000} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      {action.error && <p className="error">{action.error}</p>}
      <button type="submit" className="primary" disabled={!canSend}>
        {action.pending ? 'Wysyłanie…' : 'Zadaj pytanie'}
      </button>
    </form>
  );
}
