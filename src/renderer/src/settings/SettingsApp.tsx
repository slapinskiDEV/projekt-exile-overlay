import { useEffect, useState } from 'react';
import { useAppState } from '../lib/hooks';
import { Brand, PrivacyInfo, UpdateRequired } from '../components/common';
import { About, ClientPathField, LeaguePicker, NickField, PairingForm, ShortcutsEditor, SoundToggle } from './fields';

export function SettingsApp() {
  const state = useAppState();
  const [nick, setNick] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (state && nick === null) setNick(state.settings.nick);
  }, [state, nick]);

  if (!state || nick === null) return null;

  return (
    <div className="page">
      <Brand />
      <h1>Ustawienia</h1>

      {state.updateRequired && (
        <div className="section card">
          <UpdateRequired minVersion={state.updateRequired.minVersion} version={state.version} />
        </div>
      )}

      <section className="section">
        <h2>Konto</h2>
        {state.paired ? (
          <div className="stack">
            <p>
              Połączono jako <strong>{state.settings.profile?.displayName ?? 'gracz'}</strong>.
            </p>
            {confirmDisconnect ? (
              <div className="row">
                <span>Na pewno rozłączyć to urządzenie?</span>
                <button
                  className="danger"
                  onClick={async () => {
                    await window.overlay.disconnect();
                    setConfirmDisconnect(false);
                  }}
                >
                  Tak, rozłącz
                </button>
                <button className="ghost" onClick={() => setConfirmDisconnect(false)}>
                  Anuluj
                </button>
              </div>
            ) : (
              <button className="danger" onClick={() => setConfirmDisconnect(true)}>
                Rozłącz konto
              </button>
            )}
          </div>
        ) : (
          <div className="stack">
            <p className="muted">Tryb podglądu — połącz konto, żeby pomagać i prosić o pomoc.</p>
            <PairingForm />
          </div>
        )}
      </section>

      <section className="section">
        <h2>Liga</h2>
        <LeaguePicker value={state.settings.league} onChange={(league) => void window.overlay.updateSettings({ league })} />
      </section>

      <section className="section">
        <h2>Nick postaci</h2>
        <NickField state={state} value={nick} onChange={setNick} />
        <button
          style={{ marginTop: 8 }}
          disabled={nick.trim() === state.settings.nick}
          onClick={() => void window.overlay.updateSettings({ nick })}
        >
          Zapisz nick
        </button>
      </section>

      <section className="section">
        <h2>Plik logu gry</h2>
        <ClientPathField state={state} />
      </section>

      <section className="section">
        <h2>Skróty</h2>
        <ShortcutsEditor state={state} />
      </section>

      <section className="section">
        <h2>Powiadomienia</h2>
        <SoundToggle state={state} />
      </section>

      <section className="section">
        <h2>Prywatność</h2>
        <PrivacyInfo />
      </section>

      <section className="section">
        <h2>O aplikacji</h2>
        <About state={state} />
      </section>
    </div>
  );
}
