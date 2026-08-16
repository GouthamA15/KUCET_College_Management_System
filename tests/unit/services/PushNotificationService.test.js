import { describe, it, expect, vi } from 'vitest';
import PushNotificationService from '@/services/security/PushNotificationService';

vi.mock('@/db', () => ({
  db: {
    query: {
      pushSubscriptions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notificationPreferences: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(true),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(true),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(true),
    }),
  },
}));

describe('PushNotificationService', () => {
  it('should subscribe browser push endpoint successfully', async () => {
    const sub = {
      endpoint: 'https://push.example.com/sub/123',
      keys: { p256dh: 'p256dh_key', auth: 'auth_secret' },
    };

    const res = await PushNotificationService.subscribe('218W1A0501', 'student', sub);
    expect(res.success).toBe(true);
    expect(res.created).toBe(true);
  });

  it('should return default notification preferences when none set', async () => {
    const prefs = await PushNotificationService.getPreferences('218W1A0501', 'student');
    expect(prefs.attendance).toBe(true);
    expect(prefs.marks).toBe(true);
  });

  it('should update notification preferences', async () => {
    const categories = { attendance: true, marks: false, fees: true };
    const res = await PushNotificationService.updatePreferences('218W1A0501', 'student', categories);
    expect(res.success).toBe(true);
    expect(res.categories).toEqual(categories);
  });

  it('should gracefully handle sendToRecipients when VAPID is not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await PushNotificationService.sendToRecipients(['218W1A0501'], { title: 'Test', body: 'Test' });
    expect(res.success).toBe(true);
    expect(res.sentCount).toBe(0);
    expect(res.reason).toContain('VAPID');
  });
});
