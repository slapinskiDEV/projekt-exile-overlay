import { useState } from 'react';
import type { AppState } from '@shared/ipc';
import { useAction, useApi } from '../lib/hooks';
import { timeAgo } from '../lib/format';
import { LoginRequired } from '../components/common';

export function ThreadDetail({ id, state, onBack }: { id: string; state: AppState; onBack: () => void }) {
  const { data, error, loading, reload } = useApi(() => window.overlay.thread(id), [id], {
    refreshMs: 30_000,
    enabled: state.panelVisible,
  });
  const [reply, setReply] = useState('');
  const action = useAction();

  const send = async () => {
    const result = await action.run(() => window.overlay.replyToThread(id, reply.trim()));
    if (result !== null) {
      setReply('');
      await reload();
    }
  };

  return (
    <div className="stack">
      <button className="ghost" onClick={onBack}>
        ← Wróć
      </button>
      {error && <p className="error">{error.message}</p>}
      {!data && loading && <p className="muted">Ładowanie…</p>}
      {data && (
        <>
          <h2>{data.thread.title}</h2>
          <p className="muted small">
            {data.thread.authorName ?? 'Gracz'} · {timeAgo(data.thread.createdAt)} ·{' '}
            <button className="link" onClick={() => void window.overlay.openExternal(data.thread.url)}>
              Otwórz na forum
            </button>
          </p>
          <p className="content">{data.thread.content}</p>
          <h3>Odpowiedzi ({data.posts.length})</h3>
          {data.posts.length === 0 && <p className="muted small">Nikt jeszcze nie odpowiedział.</p>}
          {data.posts.map((post) => (
            <div key={post.id} className="message">
              <div className="who">
                {post.authorName ?? 'Gracz'} · {timeAgo(post.createdAt)}
              </div>
              {post.content}
            </div>
          ))}
          {state.paired ? (
            <div className="stack">
              <textarea value={reply} maxLength={10_000} placeholder="Twoja odpowiedź…" onChange={(e) => setReply(e.target.value)} />
              {action.error && <p className="error">{action.error}</p>}
              <button className="primary" disabled={action.pending || reply.trim().length < 2} onClick={() => void send()}>
                {action.pending ? 'Wysyłanie…' : 'Odpowiedz'}
              </button>
            </div>
          ) : (
            <LoginRequired />
          )}
        </>
      )}
    </div>
  );
}
