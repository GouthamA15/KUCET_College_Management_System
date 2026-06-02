import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getNow } from '@/lib/clock';

/**
 * Utility to handle idempotency for critical transactions.
 */
export default class IdempotencyService {
  /**
   * Start an idempotent operation.
   * @param {string} key - Unique idempotency key.
   * @param {number} ttlMinutes - How long the key remains valid.
   * @returns {Promise<{isDuplicate: boolean, response: Object|null}>}
   */
  static async start(key, ttlMinutes = 60 * 24) {
    if (!key) return { isDuplicate: false, response: null };

    const now = getNow();
    
    // 1. Check if key exists
    const existing = await db.query.idempotencyKeys.findFirst({
      where: eq(idempotencyKeys.idempotency_key, key)
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        return { isDuplicate: true, response: existing.response_body, code: existing.response_code };
      }
      if (existing.status === 'STARTED' && new Date(existing.expires_at) > now) {
        throw new Error('Transaction already in progress');
      }
    }

    // 2. Register new key or reset expired/failed
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60000);
    
    if (existing) {
      await db.update(idempotencyKeys)
        .set({ status: 'STARTED', expires_at: expiresAt, created_at: now })
        .where(eq(idempotencyKeys.id, existing.id));
    } else {
      await db.insert(idempotencyKeys).values({
        idempotency_key: key,
        status: 'STARTED',
        expires_at: expiresAt,
        created_at: now
      });
    }

    return { isDuplicate: false, response: null };
  }

  /**
   * Complete an idempotent operation.
   */
  static async complete(key, responseCode, responseBody) {
    if (!key) return;
    await db.update(idempotencyKeys)
      .set({
        status: 'COMPLETED',
        response_code: responseCode,
        response_body: responseBody
      })
      .where(eq(idempotencyKeys.idempotency_key, key));
  }

  /**
   * Mark an idempotent operation as failed so it can be retried.
   */
  static async fail(key) {
    if (!key) return;
    await db.update(idempotencyKeys)
      .set({ status: 'FAILED' })
      .where(eq(idempotencyKeys.idempotency_key, key));
  }
}
