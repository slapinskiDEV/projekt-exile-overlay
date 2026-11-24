import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

/**
 * Przesuwanie panelu za pasek tytułu (0.1.1). Pozycja jest zapamiętywana, a po zmianie
 * rozdzielczości przycinana do ekranu, żeby panel nigdy nie uciekł poza widok.
 */
export interface PanelPosition {
  x: number;
  y: number;
}

const STORAGE_KEY = 'pe.panelPosition';
const MARGIN = 8;
const HEADER_HEIGHT = 44;

function load(): PanelPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as PanelPosition) : null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch {
    return null;
  }
}

export function clampPosition(
  pos: PanelPosition,
  size: { width: number },
  viewport: { width: number; height: number },
): PanelPosition {
  return {
    x: Math.min(Math.max(pos.x, MARGIN), Math.max(MARGIN, viewport.width - size.width - MARGIN)),
    y: Math.min(Math.max(pos.y, MARGIN), Math.max(MARGIN, viewport.height - HEADER_HEIGHT - MARGIN)),
  };
}

export function useDraggable(onDragStart?: () => void) {
  const [position, setPosition] = useState<PanelPosition | null>(() => load());
  const drag = useRef<{ dx: number; dy: number; width: number } | null>(null);

  useEffect(() => {
    const onResize = () =>
      setPosition((pos) => (pos ? clampPosition(pos, { width: 440 }, { width: innerWidth, height: innerHeight }) : pos));
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      // Przyciski w pasku działają normalnie.
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      const panel = (event.currentTarget as HTMLElement).closest('.panel') as HTMLElement | null;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width };
      event.currentTarget.setPointerCapture(event.pointerId);
      onDragStart?.();
      event.preventDefault();
    },
    [onDragStart],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    setPosition(
      clampPosition(
        { x: event.clientX - d.dx, y: event.clientY - d.dy },
        { width: d.width },
        { width: innerWidth, height: innerHeight },
      ),
    );
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setPosition((pos) => {
      try {
        if (pos) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        // Brak localStorage — pozycja zostaje do zamknięcia overlaya.
      }
      return pos;
    });
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nic
    }
  }, []);

  const style = position ? { left: position.x, top: position.y, right: 'auto' as const } : undefined;

  return { style, handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick: reset } };
}
