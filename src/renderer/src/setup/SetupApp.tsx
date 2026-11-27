import { useEffect, useState } from 'react';
import { useAppState } from '../lib/hooks';
import { Brand, PrivacyInfo, UpdateRequired } from '../components/common';
import { ClientPathField, LeaguePicker, NickField, PairingForm } from '../settings/fields';

type Step = 'privacy' | 'league' | 'pair' | 'log' | 'nick' | 'done';

const STEPS: Step[] = ['privacy', 'league', 'pair', 'log', 'nick', 'done'];

/**
 * Kreator pierwszego uruchomienia: prywatność → liga → konto → Client.txt → nick.
 * Plik logu jest przed nickiem, żeby podpowiedź nicku była już dostępna.
 */
export function SetupApp({ initialStep }: { initialStep: string | null }) {
  const state = useAppState();
  const [step, setStep] = useState<Step | null>(null);
  const [nick, setNick] = useState('');
  const [pairedAs, setPairedAs] = useState<string | null>(null);

  useEffect(() => {
    if (!state || step) return;
    setNick(state.settings.nick);
    if (initialStep === 'pair' && state.settings.privacyAccepted) setStep('pair');
    else setStep(state.settings.privacyAccepted ? 'league' : 'privacy');
  }, [state, step, initialStep]);

  if (!state || !step) return null;

  if (state.updateRequired) {
    return (
      <div className="page">
        <Brand />
        <UpdateRequired minVersion={state.updateRequired.minVersion} version={state.version} />
      </div>
    );
  }

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!);
  const prev = () => setStep(STEPS[Math.max(1, index - 1)]!);

  return (
    <div className="page">
      <Brand />
      <div className="steps" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={i <= index ? 'done' : ''} />
        ))}
      </div>

      {step === 'privacy' && (
        <section>
          <h1>Co czyta overlay</h1>
          <PrivacyInfo />
          <button
            className="primary"
            onClick={async () => {
              await window.overlay.acceptPrivacy();
              next();
            }}
          >
            Rozumiem
          </button>
        </section>
      )}

      {step === 'league' && (
        <section className="stack">
          <h1>Wybierz ligę</h1>
          <p className="muted">Overlay pokaże prośby z tej ligi. Zmienisz ją w ustawieniach.</p>
          <LeaguePicker value={state.settings.league} onChange={(league) => void window.overlay.updateSettings({ league })} />
          <div className="row">
            <button className="primary" disabled={!state.settings.league} onClick={next}>
              Dalej
            </button>
          </div>
        </section>
      )}

      {step === 'pair' && (
        <section className="stack">
          <h1>Połącz z kontem</h1>
          {state.paired ? (
            <>
              <p className="success">
                Połączono{pairedAs || state.settings.profile?.displayName ? ` jako ${pairedAs ?? state.settings.profile?.displayName}` : ''}.
              </p>
              <div className="row">
                <button onClick={prev}>Wstecz</button>
                <button className="primary" onClick={next}>
                  Dalej
                </button>
              </div>
            </>
          ) : (
            <>
              <PairingForm onPaired={(name) => setPairedAs(name)} />
              <hr className="divider" />
              <p className="muted small">
                Bez konta zobaczysz tylko listę próśb. Żeby pomagać albo prosić o pomoc, połącz konto później w
                ustawieniach.
              </p>
              <div className="row">
                <button onClick={prev}>Wstecz</button>
                <button
                  onClick={async () => {
                    await window.overlay.usePreviewMode();
                    next();
                  }}
                >
                  Tylko podgląd
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'log' && (
        <section className="stack">
          <h1>Plik logu gry</h1>
          <p className="muted">
            Z pliku <code>Client.txt</code> overlay bierze nazwę i poziom obszaru oraz podpowiedź nicku. Gra powinna
            działać w trybie <strong>okna bez ramki</strong> (Windowed Fullscreen), żeby overlay był widoczny.
          </p>
          <ClientPathField state={state} autoDetect />
          <div className="row">
            <button onClick={prev}>Wstecz</button>
            <button className="primary" onClick={next}>
              {state.settings.clientTxtPath ? 'Dalej' : 'Pomiń'}
            </button>
          </div>
        </section>
      )}

      {step === 'nick' && (
        <section className="stack">
          <h1>Nick postaci</h1>
          <p className="muted">Pomocnicy użyją go, żeby napisać do Ciebie albo zaprosić do drużyny.</p>
          <NickField state={state} value={nick} onChange={setNick} />
          <div className="row">
            <button onClick={prev}>Wstecz</button>
            <button
              className="primary"
              onClick={async () => {
                await window.overlay.updateSettings({ nick });
                next();
              }}
            >
              Dalej
            </button>
          </div>
        </section>
      )}

      {step === 'done' && (
        <section className="stack">
          <h1>Gotowe</h1>
          <p>Overlay działa w zasobniku systemowym (obok zegara). Skróty w grze:</p>
          <ul className="bullets">
            <li>
              <strong>{state.settings.shortcuts.togglePanel}</strong> — pokaż / ukryj panel z prośbami
            </li>
            <li>
              <strong>{state.settings.shortcuts.requestHelp}</strong> — poproś o pomoc
            </li>
            <li>
              <strong>{state.settings.shortcuts.offerHelp}</strong> — zaoferuj pomoc
            </li>
            <li>
              <strong>{state.settings.shortcuts.askItem}</strong> — zapytaj o przedmiot pod kursorem
            </li>
          </ul>
          <div className="row">
            <button onClick={prev}>Wstecz</button>
            <button className="primary" onClick={() => void window.overlay.finishSetup()}>
              Zaczynamy
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
