import { describe, expect, it, vi } from 'vitest';
import type { OverlayNotification } from '@shared/api-types';
import { NotificationPoller } from '../main/notifications';

function n(id: string, type: string, createdAt: string, isRead = false): OverlayNotification {
  return { id, type, title: id, message: '', url: 'https://projektexile.pl/x', isRead, createdAt, contractId: null };
}

describe('NotificationPoller', () => {
  it('shows new unread notifications of interesting types once and marks them read', async () => {
    let list = [
      n('1', 'contract_application', '2026-11-20T10:00:00Z'),
      n('2', 'forum_like', '2026-11-20T10:01:00Z'),
      n('3', 'contract_accepted', '2026-11-20T10:02:00Z', true),
    ];
    const api = {
      notifications: vi.fn(async () => ({ ok: true as const, data: { notifications: list } })),
      markRead: vi.fn(async () => ({ ok: true as const, data: { ok: true as const } })),
    };
    const show = vi.fn();
    const poller = new NotificationPoller(api, show);

    await poller.poll();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]![0].id).toBe('1');
    expect(api.markRead).toHaveBeenCalledWith(['1']);

    list = [n('4', 'contract_expiry_warning', '2026-11-20T11:00:00Z'), ...list];
    await poller.poll();
    expect(show).toHaveBeenCalledTimes(2);
    expect(show.mock.calls[1]![0].id).toBe('4');
  });

  it('limits the backlog on the first poll', async () => {
    const list = ['1', '2', '3', '4', '5'].map((id) => n(id, 'contract_message', `2026-11-20T10:0${id}:00Z`));
    const api = {
      notifications: vi.fn(async () => ({ ok: true as const, data: { notifications: list } })),
      markRead: vi.fn(async () => ({ ok: true as const, data: { ok: true as const } })),
    };
    const show = vi.fn();
    await new NotificationPoller(api, show).poll();
    expect(show.mock.calls.map((c) => c[0].id)).toEqual(['3', '4', '5']);
  });
});
