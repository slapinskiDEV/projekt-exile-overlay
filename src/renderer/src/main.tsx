import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jersey-10';
import '@fontsource/vt323';
import './styles.css';
import { OverlayApp } from './overlay/OverlayApp';
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

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    {view === 'setup' ? (
      <SetupApp initialStep={params.get('step')} />
    ) : view === 'settings' ? (
      <SettingsApp />
    ) : (
      <OverlayApp />
    )}
  </StrictMode>,
);
