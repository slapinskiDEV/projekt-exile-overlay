import { useEffect, useState } from 'react';
import { GGG_DISCLAIMER, PAIRING_URL, SITE_URL, type AppState } from '@shared/ipc';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  acceleratorFromKeyEvent,
  validateShortcuts,
  type ShortcutAction,
  type ShortcutMap,
} from '@shared/shortcuts';
import { useAction, useApi } from '../lib/hooks';
import sound from '../assets/notify.wav';

/** Wybór ligi z listy PoE 2 pobranej przez API. */
export function LeaguePicker({ value, onChange }: { value: string | null; onChange: (league: string) => void }) {
  const { data, error, loading, reload } = useApi(() => window.overlay.leagues(), []);
  if (error) {
    return (
      <div className="stack">
        <p className="error">{error.message}</p>
        <button onClick={() => void reload()}>Spróbuj ponownie</button>
      </div>
    );
  }
  if (!data && loading) return <p className="muted">Pobieranie listy lig…</p>;
  return (
    <div className="option-list" role="radiogroup" aria-label="Liga">
      {data?.leagues.map((league) => (
        <label key={league.id} className={`option ${value === league.id ? 'selected' : ''}`}>
          <input type="radio" name="league" checked={value === league.id} onChange={() => onChange(league.id)} />
          {league.name}
        </label>
      ))}
    </div>
  );
}

/** Kod parowania z profilu na stronie (8 znaków). */
export function PairingForm({ onPaired }: { onPaired?: (name: string | null) => void }) {
  const [code, setCode] = useState('');
  const action = useAction();
  const clean = code.replace(/[\s-]/g, '').toUpperCase();

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (clean.length !== 8) return;
        const result = await action.run(() => window.overlay.pair(clean));
        if (result) onPaired?.(result.user.displayName);
      }}
    >
      <p>
        Na stronie wejdź w <strong>Profil → Ustawienia → „Połącz overlay”</strong> i przepisz 8-znakowy kod.{' '}
        <button type="button" className="link" onClick={() => void window.overlay.openExternal(PAIRING_URL)}>
          Otwórz ustawienia profilu
        </button>
      </p>
      <input
        className="code-input"
        type="text"
        aria-label="Kod parowania"
        maxLength={9}
        value={code}
        placeholder="ABCD1234"
        onChange={(e) => setCode(e.target.value)}
      />
      {action.error && <p className="error">{action.error}</p>}
      <button type="submit" className="primary" disabled={clean.length !== 8 || action.pending}>
        {action.pending ? 'Łączenie…' : 'Połącz'}
      </button>
    </form>
  );
}

/** Ścieżka do `Client.txt`: autowykrycie albo wybór pliku. */
export function ClientPathField({ state, autoDetect }: { state: AppState; autoDetect?: boolean }) {
  const [found, setFound] = useState<string[] | null>(null);
  const path = state.settings.clientTxtPath;

  const detect = async () => {
    const list = await window.overlay.detectClientTxt();
    setFound(list);
    if (list[0] && !path) await window.overlay.updateSettings({ clientTxtPath: list[0] });
  };

  useEffect(() => {
    if (autoDetect && !path) void detect();
  }, []);

  return (
    <div className="stack">
      {path ? <div className="path">{path}</div> : <p className="muted">Nie wskazano pliku.</p>}
      {path && state.log.path === path && state.log.status === 'missing' && (
        <p className="error">Nie ma takiego pliku. Sprawdź ścieżkę albo uruchom grę raz, żeby go utworzyła.</p>
      )}
      {path && state.log.path === path && state.log.status === 'watching' && (
        <p className="success small">
          Plik działa{state.area ? ` — ostatni obszar: ${state.area.name}${state.area.level ? ` (poziom obszaru ${state.area.level})` : ''}` : ''}.
        </p>
      )}
      {found && found.length === 0 && (
        <p className="small muted">
          Nie znaleziono gry w domyślnych miejscach Steama ani GGG. Wskaż plik <code>logs\Client.txt</code> w folderze gry.
        </p>
      )}
      {found && found.length > 1 && (
        <div className="option-list">
          {found.map((p) => (
            <label key={p} className={`option ${p === path ? 'selected' : ''}`}>
              <input type="radio" checked={p === path} onChange={() => void window.overlay.updateSettings({ clientTxtPath: p })} />
              <span className="small">{p}</span>
            </label>
          ))}
        </div>
      )}
      <div className="row">
        <button type="button" onClick={() => void detect()}>
          Wykryj automatycznie
        </button>
        <button
          type="button"
          onClick={async () => {
            const chosen = await window.overlay.chooseClientTxt();
            if (chosen) await window.overlay.updateSettings({ clientTxtPath: chosen });
          }}
        >
          Wybierz plik
        </button>
      </div>
    </div>
  );
}

/** Nick postaci z podpowiedzią z czatu lokalnego. */
export function NickField({ state, value, onChange }: { state: AppState; value: string; onChange: (nick: string) => void }) {
  const hint = state.nickHint;
  return (
    <div className="stack">
      <input type="text" aria-label="Nick postaci" maxLength={40} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && hint !== value && (
        <p className="small muted">
          Podpowiedź z logu gry: <strong>{hint}</strong>{' '}
          <button type="button" className="link" onClick={() => onChange(hint)}>
            Użyj
          </button>
        </p>
      )}
      {!hint && (
        <p className="small muted">
          Podpowiedź pojawi się po najbliższym awansie postaci (gra zapisuje go w logu). Możesz też wpisać nick
          ręcznie.
        </p>
      )}
    </div>
  );
}

/** Pole „naciśnij skrót”: na czas nagrywania globalne skróty są wyłączone. */
function ShortcutInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [recording, setRecording] = useState(false);
  return (
    <input
      className="shortcut-input"
      type="text"
      readOnly
      value={recording ? 'Naciśnij skrót…' : value}
      onFocus={() => {
        setRecording(true);
        void window.overlay.suspendShortcuts(true);
      }}
      onBlur={() => {
        setRecording(false);
        void window.overlay.suspendShortcuts(false);
      }}
      onKeyDown={(e) => {
        e.preventDefault();
        if (e.key === 'Escape') {
          (e.target as HTMLInputElement).blur();
          return;
        }
        const accelerator = acceleratorFromKeyEvent(e);
        if (accelerator) {
          onChange(accelerator);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function ShortcutsEditor({ state }: { state: AppState }) {
  const [map, setMap] = useState<ShortcutMap>(state.settings.shortcuts);
  const [errors, setErrors] = useState<Partial<Record<ShortcutAction, string>>>({});
  const [saved, setSaved] = useState(false);
  const local = validateShortcuts(map);
  const shown = { ...state.shortcutErrors, ...errors, ...local };
  const changed = JSON.stringify(map) !== JSON.stringify(state.settings.shortcuts);

  return (
    <div className="stack">
      {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((action) => (
        <div key={action} className="field">
          <label>{SHORTCUT_LABELS[action]}</label>
          <ShortcutInput
            value={map[action]}
            onChange={(value) => {
              setSaved(false);
              setErrors({});
              setMap((m) => ({ ...m, [action]: value }));
            }}
          />
          {shown[action] && <p className="error">{shown[action]}</p>}
        </div>
      ))}
      <p className="small muted">Każdy skrót wykonuje w grze najwyżej jedną akcję.</p>
      <div className="row">
        <button
          className="primary"
          disabled={!changed || Object.keys(local).length > 0}
          onClick={async () => {
            const result = await window.overlay.setShortcuts(map);
            setErrors(result.errors);
            setSaved(result.ok);
          }}
        >
          Zapisz skróty
        </button>
        <button
          onClick={() => {
            setMap({ ...DEFAULT_SHORTCUTS });
            setErrors({});
          }}
        >
          Przywróć domyślne
        </button>
        {saved && <span className="success small">Zapisano.</span>}
      </div>
    </div>
  );
}

export function SoundToggle({ state }: { state: AppState }) {
  return (
    <div className="row">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.settings.soundEnabled}
          onChange={(e) => void window.overlay.updateSettings({ soundEnabled: e.target.checked })}
        />
        Dźwięk przy powiadomieniach
      </label>
      <button
        className="ghost"
        onClick={() => {
          const audio = new Audio(sound);
          audio.volume = 0.6;
          void audio.play().catch(() => undefined);
        }}
      >
        Odtwórz
      </button>
    </div>
  );
}

export function About({ state }: { state: AppState }) {
  return (
    <div className="stack">
      <p>
        Projekt Exile Overlay <strong>{state.version}</strong>
      </p>
      <p className="disclaimer">{GGG_DISCLAIMER}</p>
      <div className="row">
        <button onClick={() => void window.overlay.openExternal(SITE_URL)}>projektexile.pl</button>
        <button onClick={() => void window.overlay.checkForUpdates()}>Sprawdź aktualizacje</button>
      </div>
    </div>
  );
}
