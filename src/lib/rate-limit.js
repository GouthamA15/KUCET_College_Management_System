import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import { eq, sql, lt } from 'drizzle-orm';

/**
 * Robust Rate Limiter using MySQL (Drizzle)
 * For production, consider moving to Upstash Redis if running on serverless.
 * @param {string} key - Unique key for the limit
 * @param {number} limit - Max allowed points
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
export async function checkRateLimit(key, limit, windowSeconds) {
  try {
    const now = new Date();
    
    // 1. Occasional cleanup (10% chance)
    if (Math.random() < 0.1) {
      db.delete(rateLimits)
        .where(lt(rateLimits.expire_at, now))
        .execute()
        .catch(e => console.error('[RATE_LIMIT_CLEANUP_ERROR]', e));
    }

    // 2. Try to fetch existing limit
    const existing = await db.query.rateLimits.findFirst({
      where: eq(rateLimits.key_name, key)
    });

    if (!existing) {
      // Create new record
      const expireAt = new Date(now.getTime() + windowSeconds * 1000);
      await db.insert(rateLimits).values({
        key_name: key,
        points: 1,
        expire_at: expireAt
      });
      return { success: true, remaining: limit - 1 };
    }

    // 3. Check if expired
    if (new Date(existing.expire_at) < now) {
      const newExpireAt = new Date(now.getTime() + windowSeconds * 1000);
      await db.update(rateLimits)
        .set({ 
          points: 1, 
          expire_at: newExpireAt 
        })
        .where(eq(rateLimits.key_name, key));
      return { success: true, remaining: limit - 1 };
    }

    // 4. Check points
    if (existing.points >= limit) {
      return { success: false, remaining: 0 };
    }

    // 5. Atomic increment
    await db.update(rateLimits)
      .set({ 
        points: sql`${rateLimits.points} + 1` 
      })
      .where(eq(rateLimits.key_name, key));

    return { success: true, remaining: limit - (existing.points + 1) };

  } catch (error) {
    console.error('[RATE_LIMIT_ERROR]', error);
    return { success: true, remaining: 1 }; // Fail open
  }
}
