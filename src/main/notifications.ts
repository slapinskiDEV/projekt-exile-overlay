import type { OverlayNotification } from '@shared/api-types';
import type { ApiClient } from './api';

/** Powiadomienia pokazywane w overlayu (reszta zostaje na stronie). */
export const OVERLAY_NOTIFICATION_TYPES = new Set([
  'contract_application',
  'contract_accepted',
  'contract_verified',
  'contract_expiry_warning',
  'contract_finish_reminder',
  'reply_to_post',
  'contract_message',
  // Oferty i problemy (0.3.4) — wcześniej filtr je pomijał i oferty nie dawały znaku.
  'contract_offer_joined',
  'contract_offer_left',
  'contract_offer_removed',
  'contract_offer_started',
  'contract_offer_confirm_request',
  'contract_offer_confirmed',
  'contract_offer_cancelled',
  'contract_problem_reported',
  'contract_problem_resolved',
]);

/** Przy pierwszym pobraniu pokazujemy najwyżej tyle zaległych powiadomień. */
const FIRST_RUN_LIMIT = 3;

/**
 * Pobieranie powiadomień co `intervalMs` (Realtime tylko przyspiesza pobranie).
 * Pokazane okienkiem powiadomienie jest oznaczane jako przeczytane.
 */
export class NotificationPoller {
  private seen = new Set<string>();
  private first = true;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly api: Pick<ApiClient, 'notifications' | 'markRead'>,
    private readonly show: (notification: OverlayNotification) => void,
    private readonly intervalMs = 25_000,
    /** Każde nowe powiadomienie o kontrakcie — otwarte widoki od razu się odświeżają. */
    private readonly onContractChange: (contractId: string) => void = () => undefined,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  reset(): void {
    this.stop();
    this.seen.clear();
    this.first = true;
  }

  async poll(): Promise<OverlayNotification[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const result = await this.api.notifications();
      if (!result.ok) return [];
      const fresh = result.data.notifications.filter((n) => !n.isRead && !this.seen.has(n.id));
      fresh.forEach((n) => this.seen.add(n.id));
      if (!this.first) {
        for (const id of new Set(fresh.map((n) => n.contractId).filter((c): c is string => Boolean(c)))) {
          this.onContractChange(id);
        }
      }

      let toShow = fresh
        .filter((n) => OVERLAY_NOTIFICATION_TYPES.has(n.type))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (this.first) toShow = toShow.slice(-FIRST_RUN_LIMIT);
      this.first = false;

      toShow.forEach((n) => this.show(n));
      if (toShow.length > 0) await this.api.markRead(toShow.map((n) => n.id));
      return toShow;
    } finally {
      this.running = false;
    }
  }
}
