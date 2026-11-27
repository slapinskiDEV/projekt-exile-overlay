// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OverlayApp } from '../renderer/src/overlay/OverlayApp';

afterEach(cleanup);

/**
 * 0.1.1: hook przeciągania stał za `if (!state) return null`, więc gdy stan przyszedł
 * z procesu głównego, React wywracał nakładkę i Alt+H nic nie pokazywało. Test rysuje
 * aplikację tak jak w Electronie: najpierw bez stanu, potem z widocznym panelem.
 */
describe('OverlayApp', () => {
  it('pokazuje panel, gdy stan przychodzi asynchronicznie', async () => {
    const state = {
      version: '0.1.1',
      settings: { league: 'Runes of Aldur', soundEnabled: false, shortcuts: {} },
      paired: true,
      area: { name: 'Przejście Zdrajcy', level: 53 },
      nickHint: 'Dawnbringer',
      character: { name: 'Dawnbringer', className: 'Mercenary', level: 41 },
      updateRequired: null,
      panelVisible: true,
      log: { status: 'watching', path: 'C:/Client.txt' },
      shortcutErrors: {},
    };
    const pending = () => new Promise(() => {});
    (window as unknown as { overlay: unknown }).overlay = new Proxy(
      {
        getState: () => Promise.resolve(state),
        on: () => () => {},
        setInteractive: () => Promise.resolve(),
        setPanelVisible: () => Promise.resolve(),
      } as Record<string, unknown>,
      { get: (target, key: string) => target[key] ?? pending },
    );

    render(<OverlayApp />);
    expect(await screen.findByText('Projekt Exile')).toBeTruthy();
    expect(screen.getByText(/poziom obszaru 53/)).toBeTruthy();
    expect(screen.getByText(/Dawnbringer · 41 lvl/)).toBeTruthy();
  });
});
