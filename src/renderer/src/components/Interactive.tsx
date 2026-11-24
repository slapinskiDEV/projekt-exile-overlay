import { useEffect, type ReactNode, type CSSProperties } from 'react';

/**
 * Element, nad którym okno overlaya ma łapać mysz. Poza nim kliknięcia przechodzą
 * do gry (okno jest przezroczyste dla myszy).
 */
export function Interactive({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  useEffect(() => () => void window.overlay.setInteractive(false), []);
  return (
    <div
      className={className}
      style={style}
      onMouseEnter={() => void window.overlay.setInteractive(true)}
      onMouseLeave={() => void window.overlay.setInteractive(false)}
    >
      {children}
    </div>
  );
}
