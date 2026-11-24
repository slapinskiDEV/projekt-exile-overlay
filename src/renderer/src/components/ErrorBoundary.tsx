import { Component, type ReactNode } from 'react';

/**
 * Błąd w interfejsie nakładki nie może zostawić pustego, przezroczystego okna — gracz
 * widzi wtedy tylko, że skrót „nic nie robi”. Pokazujemy komunikat i przycisk
 * przeładowania; treść błędu trafia do dziennika diagnostycznego (console.error).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[pe] render error', error.message, error.stack ?? '', info.componentStack ?? '');
    void window.overlay?.setInteractive?.(true);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel" role="alert">
        <div className="panel-body stack">
          <h2>Coś poszło nie tak</h2>
          <p className="small">{this.state.error.message}</p>
          <p className="small muted">
            Szczegóły są w dzienniku diagnostycznym (ikona w zasobniku → „Otwórz dziennik diagnostyczny”).
          </p>
          <button className="primary" onClick={() => location.reload()}>
            Przeładuj nakładkę
          </button>
        </div>
      </div>
    );
  }
}
