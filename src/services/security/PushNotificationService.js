import { db } from '@/db';
import { pushSubscriptions, notificationPreferences } from '@/db/schema/security';
import { eq, and, inArray } from 'drizzle-orm';
import logger from '@/lib/logger';
import webpush from 'web-push';

export class PushNotificationService {
  /**
   * Registers a browser push subscription for a user
   */
  static async subscribe(userId, userType, subscription) {
    try {
      const { endpoint, keys } = subscription;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Invalid subscription object');
      }

      // Existing check
      const existing = await db.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.user_id, String(userId)),
          eq(pushSubscriptions.user_type, userType.toLowerCase())
        ),
      });

      if (existing) {
        await db.update(pushSubscriptions)
          .set({
            endpoint,
            p256dh: keys.p256dh,
            auth_secret: keys.auth,
            created_at: new Date(),
          })
          .where(eq(pushSubscriptions.id, existing.id));
        return { success: true, updated: true };
      }

      await db.insert(pushSubscriptions).values({
        user_id: String(userId),
        user_type: userType.toLowerCase(),
        endpoint,
        p256dh: keys.p256dh,
        auth_secret: keys.auth,
      });

      return { success: true, created: true };
    } catch (err) {
      logger.error({ err, userId, userType }, '[PushNotificationService] Subscription failed');
      throw err;
    }
  }

  /**
   * Unsubscribes a user's browser push endpoint
   */
  static async unsubscribe(userId, userType) {
    try {
      await db.delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.user_id, String(userId)),
          eq(pushSubscriptions.user_type, userType.toLowerCase())
        ));
      return { success: true };
    } catch (err) {
      logger.error({ err, userId, userType }, '[PushNotificationService] Unsubscribe failed');
      throw err;
    }
  }

  /**
   * Updates notification category preferences for a user
   */
  static async updatePreferences(userId, userType, categories) {
    try {
      const existing = await db.query.notificationPreferences.findFirst({
        where: and(
          eq(notificationPreferences.user_id, String(userId)),
          eq(notificationPreferences.user_type, userType.toLowerCase())
        ),
      });

      if (existing) {
        await db.update(notificationPreferences)
          .set({ categories, updated_at: new Date() })
          .where(eq(notificationPreferences.id, existing.id));
      } else {
        await db.insert(notificationPreferences).values({
          user_id: String(userId),
          user_type: userType.toLowerCase(),
          categories,
        });
      }

      return { success: true, categories };
    } catch (err) {
      logger.error({ err, userId, userType }, '[PushNotificationService] Preference update failed');
      throw err;
    }
  }

  /**
   * Fetches notification preferences for a user
   */
  static async getPreferences(userId, userType) {
    const existing = await db.query.notificationPreferences.findFirst({
      where: and(
        eq(notificationPreferences.user_id, String(userId)),
        eq(notificationPreferences.user_type, userType.toLowerCase())
      ),
    });

    return existing?.categories || {
      attendance: true,
      marks: true,
      fees: true,
      system: true,
      approvals: true,
    };
  }

  /**
   * Dispatches push notification to recipients array using web-push
   */
  static async sendToRecipients(recipients = [], notification = {}) {
    logger.info({ count: recipients.length, notification }, '[PushNotificationService] Sending push notification');

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_CONTACT_EMAIL || process.env.EMAIL_USER || 'mailto:admin@kucet.ac.in';

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.info('[PushNotificationService] VAPID keys not configured, skipping browser push dispatch');
      return { success: true, sentCount: 0, reason: 'VAPID keys not configured' };
    }

    try {
      const subjectEmail = vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`;
      webpush.setVapidDetails(subjectEmail, vapidPublicKey, vapidPrivateKey);
    } catch (vapidError) {
      logger.error({ err: vapidError }, '[PushNotificationService] Failed to set VAPID details');
      return { success: false, error: vapidError.message };
    }

    // Normalize recipient user IDs
    const userIds = recipients.map((r) => String(typeof r === 'object' && r ? (r.userId || r.id || r.user_id) : r)).filter(Boolean);

    if (userIds.length === 0) {
      return { success: true, sentCount: 0 };
    }

    // Query active push subscriptions
    let subscriptions = [];
    try {
      subscriptions = await db.select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.user_id, userIds));
    } catch (dbErr) {
      logger.error({ err: dbErr }, '[PushNotificationService] Failed querying subscriptions');
      return { success: false, error: dbErr.message };
    }

    if (subscriptions.length === 0) {
      return { success: true, sentCount: 0, reason: 'No subscriptions found' };
    }

    const payload = JSON.stringify({
      title: notification.title || 'KUCET CMS Notification',
      body: notification.body || notification.message || '',
      url: notification.url || '/',
      icon: notification.icon || '/favicon.ico',
      data: notification.data || {},
      category: notification.category || 'system',
      timestamp: Date.now(),
    });

    let sentCount = 0;
    let failedCount = 0;
    const staleSubscriptionIds = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscriptionObj = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_secret,
          },
        };

        try {
          await webpush.sendNotification(pushSubscriptionObj, payload);
          sentCount++;
        } catch (pushError) {
          failedCount++;
          // HTTP 404 or 410 indicates endpoint is gone or subscription has expired
          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            staleSubscriptionIds.push(sub.id);
          } else {
            logger.warn({ err: pushError, subId: sub.id }, '[PushNotificationService] Push delivery warning');
          }
        }
      })
    );

    // Clean up expired/gone subscriptions
    if (staleSubscriptionIds.length > 0) {
      try {
        await db.delete(pushSubscriptions)
          .where(inArray(pushSubscriptions.id, staleSubscriptionIds));
        logger.info({ count: staleSubscriptionIds.length }, '[PushNotificationService] Purged expired subscriptions');
      } catch (cleanupErr) {
        logger.warn({ err: cleanupErr }, '[PushNotificationService] Failed purging expired subscriptions');
      }
    }

    return { success: true, sentCount, failedCount, staleCount: staleSubscriptionIds.length };
  }
}

export default PushNotificationService;
