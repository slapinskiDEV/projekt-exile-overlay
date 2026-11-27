import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { PanelCommand } from '@shared/ipc';
import { useAppState } from '../lib/hooks';
import { areaLabel } from '../lib/format';
import { UpdateRequired, logo } from '../components/common';
import { ContractList } from './ContractList';
import { ContractDetail } from './ContractDetail';
import { RequestForm } from './RequestForm';
import { MyContracts } from './MyContracts';
import { ThreadList } from './ThreadList';
import { ThreadDetail } from './ThreadDetail';
import { AskForm } from './AskForm';
import { Toasts } from './Toasts';
import { Interactive } from '../components/Interactive';
import { useDraggable } from '../lib/use-draggable';

export type Tab = 'requests' | 'mine' | 'questions';

export type Screen =
  | { kind: 'tab' }
  | { kind: 'contract'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'request'; categoryId?: string; itemText?: string | null; offer?: boolean }
  | { kind: 'item-not-found' }
  | { kind: 'ask' };

export function OverlayApp() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('requests');
  const [screen, setScreen] = useState<Screen>({ kind: 'tab' });

  useEffect(
    () =>
      window.overlay.on('panel', (command: PanelCommand) => {
        if (command.kind === 'list') setScreen({ kind: 'tab' });
        else if (command.kind === 'contract') setScreen({ kind: 'contract', id: command.id });
        else if (command.kind === 'item-not-found') setScreen({ kind: 'item-not-found' });
        else setScreen({ kind: 'request', categoryId: command.categoryId, itemText: command.itemText ?? null });
      }),
    [],
  );

  const hide = useCallback(() => void window.overlay.setPanelVisible(false), []);

  useEffect(() => {
    if (!state?.panelVisible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.panelVisible, hide]);

  // Do dziennika: gdzie panel faktycznie się narysował (diagnoza „skrót nic nie pokazuje”).
  const panelVisible = state?.panelVisible ?? false;
  useEffect(() => {
    if (!panelVisible) return;
    const frame = requestAnimationFrame(() => {
      const rect = document.querySelector('.panel')?.getBoundingClientRect();
      console.info(
        '[pe] panel',
        JSON.stringify({ rect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null, viewport: [innerWidth, innerHeight] }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [panelVisible]);

  // Hook przed wcześniejszym `return` — inaczej przy pierwszym stanie React wywraca
  // nakładkę (różna liczba hooków; tak zepsuło się Alt+H w 0.1.1).
  const panelDrag = useDraggable(() => void window.overlay.setInteractive(true));

  if (!state) return null;

  const openContract = (id: string) => setScreen({ kind: 'contract', id });
  const back = () => setScreen({ kind: 'tab' });
  const where = areaLabel(state.area?.name ?? null, state.area?.level ?? null);

  let body: ReactNode;
  if (state.updateRequired) {
    body = <UpdateRequired minVersion={state.updateRequired.minVersion} version={state.version} />;
  } else if (screen.kind === 'contract') {
    body = <ContractDetail id={screen.id} state={state} onBack={back} />;
  } else if (screen.kind === 'thread') {
    body = <ThreadDetail id={screen.id} state={state} onBack={back} />;
  } else if (screen.kind === 'request') {
    body = (
      <RequestForm
        key={`${screen.categoryId ?? ''}-${screen.itemText?.length ?? 0}-${screen.offer ? 'o' : 'r'}`}
        state={state}
        initialCategory={screen.categoryId}
        itemText={screen.itemText ?? null}
        initialOffer={screen.offer ?? false}
        onBack={back}
        onOpenContract={openContract}
      />
    );
  } else if (screen.kind === 'item-not-found') {
    body = (
      <div className="stack">
        <h2>Nie znaleziono przedmiotu</h2>
        <p>
          W schowku nie ma tekstu przedmiotu z gry. Najedź kursorem na przedmiot w grze i naciśnij{' '}
          {state.settings.shortcuts.askItem} jeszcze raz.
        </p>
        <button onClick={back}>Wróć do listy</button>
      </div>
    );
  } else if (screen.kind === 'ask') {
    body = <AskForm state={state} onBack={back} onCreated={(id) => setScreen({ kind: 'thread', id })} />;
  } else if (tab === 'requests') {
    body = <ContractList state={state} onOpen={openContract} onRequest={(kind) => setScreen({ kind: 'request', offer: kind === 'offer' })} />;
  } else if (tab === 'mine') {
    body = <MyContracts state={state} onOpen={openContract} />;
  } else {
    body = (
      <ThreadList state={state} onOpen={(id) => setScreen({ kind: 'thread', id })} onAsk={() => setScreen({ kind: 'ask' })} />
    );
  }

  return (
    <>
      <Toasts
        soundEnabled={state.settings.soundEnabled}
        onOpenContract={(id) => {
          void window.overlay.setPanelVisible(true);
          openContract(id);
        }}
      />
      {state.panelVisible && (
        <Interactive className="panel" style={panelDrag.style}>
          <div
            className="panel-header draggable"
            title="Przeciągnij, żeby przesunąć panel · dwuklik przywraca miejsce"
            {...panelDrag.handlers}
          >
            <img src={logo} alt="" />
            <span className="title">Projekt Exile</span>
            <span className="badge">{state.settings.league ?? 'bez ligi'}</span>
            <button className="ghost" title="Ustawienia" onClick={() => void window.overlay.openSettings()}>
              Ustawienia
            </button>
            <button className="ghost" title="Ukryj (Esc)" onClick={hide}>
              ✕
            </button>
          </div>
          <div className="panel-area">
            {where ? `Jesteś: ${where}` : 'Obszar nieznany — wskaż Client.txt w ustawieniach.'}
            {state.character && ` · ${state.character.name}, ${state.character.level} lvl`}
            {!state.paired && ' · tryb podglądu'}
          </div>
          {screen.kind === 'tab' && !state.updateRequired && (
            <div className="tabs">
              <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
                Prośby
              </button>
              <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
                Moje
              </button>
              <button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>
                Pytania
              </button>
            </div>
          )}
          <div className="panel-body">{body}</div>
        </Interactive>
      )}
    </>
  );
}
