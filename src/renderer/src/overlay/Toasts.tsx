import { useEffect, useRef, useState } from 'react';
import type { OverlayNotification } from '@shared/api-types';
import { Interactive } from '../components/Interactive';
import { playNotificationSound } from '../lib/sounds';

const DURATION_MS = 6_000;
/** „Przedłużyć?” wymaga decyzji — zostaje dłużej. */
const EXPIRY_DURATION_MS = 20_000;

type Toast = { notification: OverlayNotification; status: string | null };

/**
 * Okienka powiadomień — widoczne także przy ukrytym panelu. Okno przepuszcza
 * kliknięcia do gry, dopóki kursor nie znajdzie się nad okienkiem.
 */
export function Toasts({
  soundEnabled,
  sound,
  volume,
  onOpenContract,
}: {
  soundEnabled: boolean;
  sound: string;
  volume: number;
  onOpenContract: (id: string) => void;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const soundRef = useRef({ soundEnabled, sound, volume });
  soundRef.current = { soundEnabled, sound, volume };

  useEffect(
    () =>
      window.overlay.on('notification', (notification) => {
        setToasts((list) => [...list.filter((t) => t.notification.id !== notification.id), { notification, status: null }].slice(-4));
        if (soundRef.current.soundEnabled) playNotificationSound(soundRef.current.sound, soundRef.current.volume);
        const ms = notification.type === 'contract_expiry_warning' ? EXPIRY_DURATION_MS : DURATION_MS;
        setTimeout(() => setToasts((list) => list.filter((t) => t.notification.id !== notification.id)), ms);
      }),
    [],
  );

  const dismiss = (id: string) => setToasts((list) => list.filter((t) => t.notification.id !== id));
  const setStatus = (id: string, status: string) =>
    setToasts((list) => list.map((t) => (t.notification.id === id ? { ...t, status } : t)));

  if (toasts.length === 0) return null;

  return (
    <div className="toasts">
      {toasts.map(({ notification, status }) => {
        const contractId = notification.contractId;
        const expiry = notification.type === 'contract_expiry_warning' && contractId;
        return (
          <Interactive key={notification.id}>
            <div
              className="toast"
              role="status"
              onClick={() => {
                dismiss(notification.id);
                if (contractId) onOpenContract(contractId);
                else void window.overlay.openExternal(notification.url);
              }}
            >
              <div className="toast-title">{notification.title}</div>
              <div className="small">{notification.message}</div>
              {status && <div className="small success">{status}</div>}
              {expiry && !status && (
                <div className="toast-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="primary"
                    onClick={async () => {
                      const result = await window.overlay.extend(contractId);
                      setStatus(notification.id, result.ok ? 'Przedłużono.' : result.error.message);
                    }}
                  >
                    Przedłuż
                  </button>
                  <button
                    className="danger"
                    onClick={async () => {
                      const result = await window.overlay.close(contractId);
                      setStatus(notification.id, result.ok ? 'Zamknięto.' : result.error.message);
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              )}
            </div>
          </Interactive>
        );
      })}
    </div>
  );
}
