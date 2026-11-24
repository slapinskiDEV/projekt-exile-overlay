import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jersey-10';
import '@fontsource/vt323';
import './styles.css';
import { OverlayApp } from './overlay/OverlayApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SetupApp } from './setup/SetupApp';
import { SettingsApp } from './settings/SettingsApp';

/** Widok z adresu: `#overlay`, `#setup?step=pair`, `#settings`. */
function parseHash(): { view: string; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '');
  const [view = 'overlay', query = ''] = raw.split('?');
  return { view, params: new URLSearchParams(query) };
}

const { view, params } = parseHash();
document.documentElement.dataset.view = view;

// Błędy poza Reactem (np. w obsłudze zdarzeń) też trafiają do dziennika diagnostycznego.
window.addEventListener('error', (event) => console.error('[pe] window error', event.message));
window.addEventListener('unhandledrejection', (event) => console.error('[pe] unhandled rejection', String(event.reason)));

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    {view === 'setup' ? (
      <SetupApp initialStep={params.get('step')} />
    ) : view === 'settings' ? (
      <SettingsApp />
    ) : (
      <ErrorBoundary>
        <OverlayApp />
      </ErrorBoundary>
    )}
  </StrictMode>,
);
