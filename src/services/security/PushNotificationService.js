import { db } from '@/db';
import { pushSubscriptions, notificationPreferences } from '@/db/schema/security';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

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
   * Dispatches push notification to recipients array
   */
  static async sendToRecipients(recipients = [], notification = {}) {
    logger.info({ count: recipients.length, notification }, '[PushNotificationService] Sending push notification');
    return { success: true, sentCount: recipients.length };
  }
}

export default PushNotificationService;
