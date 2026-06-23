import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import { eq, sql, lt } from 'drizzle-orm';
import logger from '@/lib/logger';

// Initialize Redis client if environment variables are present
let _ratelimit = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // Create a new ratelimiter that allows 'limit' requests per 'windowSeconds'
  // We use a factory-like approach inside checkRateLimit to support dynamic windows if needed,
  // but for common usage we can pre-init if the config is static.
  // Here we'll initialize a default one or handle it dynamically.
}

/**
 * Robust Rate Limiter with Redis (Primary) and MySQL (Fallback)
 * @param {string} key - Unique key for the limit
 * @param {number} limit - Max allowed points
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
export async function checkRateLimit(key, limit, windowSeconds) {
  // 1. Try Upstash Redis first (Distributed & High Performance)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      const rl = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        analytics: true,
        prefix: '@upstash/ratelimit/kucet',
      });

      const { success, remaining } = await rl.limit(key);
      return { success, remaining };
    } catch (redisError) {
      logger.error(redisError, '[RATE_LIMIT_REDIS_FAILURE] Falling back to MySQL');
    }
  }

  // 2. Fallback to MySQL (Drizzle) - Useful for local dev or if Redis fails
  try {
    const now = new Date();
    
    // Occasional cleanup (10% chance)
    if (Math.random() < 0.1) {
      db.delete(rateLimits)
        .where(lt(rateLimits.expire_at, now))
        .execute()
        .catch(e => logger.error(e, '[RATE_LIMIT_CLEANUP_ERROR]'));
    }

    const existing = await db.query.rateLimits.findFirst({
      where: eq(rateLimits.key_name, key)
    });

    if (!existing) {
      const expireAt = new Date(now.getTime() + windowSeconds * 1000);
      await db.insert(rateLimits).values({
        key_name: key,
        points: 1,
        expire_at: expireAt
      });
      return { success: true, remaining: limit - 1 };
    }

    if (new Date(existing.expire_at) < now) {
      const newExpireAt = new Date(now.getTime() + windowSeconds * 1000);
      await db.update(rateLimits)
        .set({ points: 1, expire_at: newExpireAt })
        .where(eq(rateLimits.key_name, key));
      return { success: true, remaining: limit - 1 };
    }

    if (existing.points >= limit) {
      return { success: false, remaining: 0 };
    }

    await db.update(rateLimits)
      .set({ points: sql`${rateLimits.points} + 1` })
      .where(eq(rateLimits.key_name, key));

    return { success: true, remaining: limit - (existing.points + 1) };

  } catch (dbError) {
    logger.error(dbError, '[RATE_LIMIT_DB_ERROR]');
    return { success: true, remaining: 1 }; // Fail open
  }
}


import crypto from 'crypto';

/**
 * Generates a Tiered Rate Limit Key combining IP and User-Agent.
 * Prevents locking out an entire campus sharing a single NAT IP.
 */
export function getTieredKey(req, prefix) {
  let clientIp = 'unknown_ip';
  if (req.ip) {
    clientIp = req.ip;
  } else {
    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      clientIp = xForwardedFor.split(',')[0].trim();
    }
  }

  const userAgent = req.headers.get('user-agent') || 'unknown_ua';
  const deviceHash = crypto.createHash('md5').update(`${clientIp}-${userAgent}`).digest('hex');
  
  return `${prefix}:${deviceHash}`;
}
