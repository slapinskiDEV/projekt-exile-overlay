import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { ApiClient } from './api';

/**
 * Realtime Supabase: nasłuch nowych wierszy `user_notifications` tego gracza. Każde
 * zdarzenie tylko przyspiesza pobranie powiadomień przez API — przy dowolnym błędzie
 * zostaje zwykłe odpytywanie co kilkadziesiąt sekund.
 */
export class RealtimeNotifications {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly api: Pick<ApiClient, 'realtime'>,
    private readonly onInsert: () => void,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    try {
      const result = await this.api.realtime();
      if (!result.ok || this.stopped) return;
      const { url, publishableKey, accessToken, expiresAt, userId } = result.data;

      this.client = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      await this.client.realtime.setAuth(accessToken);
      this.channel = this.client
        .channel(`overlay-notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
          () => this.onInsert(),
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Zostaje odpytywanie; nowe połączenie za minutę.
            void this.restartLater();
          }
        });
      this.scheduleRefresh(Math.max(30_000, new Date(expiresAt).getTime() - Date.now() - 60_000));
    } catch {
      this.scheduleRefresh(60_000);
    }
  }

  private scheduleRefresh(ms: number) {
    if (this.stopped) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), ms);
  }

  private async refresh(): Promise<void> {
    if (this.stopped) return;
    if (!this.client || !this.channel) {
      await this.stop();
      return this.start();
    }
    const result = await this.api.realtime();
    if (!result.ok) {
      this.scheduleRefresh(60_000);
      return;
    }
    try {
      await this.client.realtime.setAuth(result.data.accessToken);
      this.scheduleRefresh(Math.max(30_000, new Date(result.data.expiresAt).getTime() - Date.now() - 60_000));
    } catch {
      await this.restartLater();
    }
  }

  private async restartLater(): Promise<void> {
    if (this.stopped) return;
    await this.stop();
    this.stopped = false;
    this.scheduleRefresh(60_000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    const client = this.client;
    this.client = null;
    this.channel = null;
    if (client) await client.removeAllChannels().catch(() => undefined);
  }
}
