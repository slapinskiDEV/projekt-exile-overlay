import { useEffect, type ReactNode } from 'react';

/**
 * Element, nad którym okno overlaya ma łapać mysz. Poza nim kliknięcia przechodzą
 * do gry (okno jest przezroczyste dla myszy).
 */
export function Interactive({ children, className }: { children: ReactNode; className?: string }) {
  useEffect(() => () => void window.overlay.setInteractive(false), []);
  return (
    <div
      className={className}
      onMouseEnter={() => void window.overlay.setInteractive(true)}
      onMouseLeave={() => void window.overlay.setInteractive(false)}
    >
      {children}
    </div>
  );
}
