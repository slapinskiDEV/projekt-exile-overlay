import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiFailure, ApiResult, AppState } from '@shared/ipc';

/** Stan aplikacji z procesu głównego, aktualizowany zdarzeniem `state`. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    let alive = true;
    void window.overlay.getState().then((s) => alive && setState(s));
    const off = window.overlay.on('state', (s) => setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

/** Pobranie danych z API z obsługą ładowania i błędu. `deps` wyznacza ponowne pobranie. */
export function useApi<T>(
  load: () => Promise<ApiResult<T>>,
  deps: unknown[],
  options: {
    refreshMs?: number;
    enabled?: boolean;
    /** Przeładuj od razu po zdarzeniu `contract-changed` dla tego kontraktu (`'*'` — dowolnego). */
    contractId?: string;
  } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const enabled = options.enabled ?? true;

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadRef.current();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    if (!options.refreshMs) return;
    const timer = setInterval(() => void reload(), options.refreshMs);
    return () => clearInterval(timer);
  }, [enabled, options.refreshMs, reload, ...deps]);

  const watched = options.contractId;
  useEffect(() => {
    if (!enabled || !watched) return;
    return window.overlay.on('contract-changed', (id) => {
      if (watched === '*' || watched === id) void reload();
    });
  }, [enabled, watched, reload]);

  return { data, error, loading, reload };
}

/** Wysłanie formularza: blokada podwójnego kliknięcia i komunikat błędu. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(action: () => Promise<ApiResult<T>>): Promise<T | null> => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (result.ok) return result.data;
      setError(result.error.message);
      return null;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}
