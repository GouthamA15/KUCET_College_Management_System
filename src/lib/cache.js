import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';
import { getNow } from '@/lib/clock';

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Circuit Breaker state
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 30000; // 30 seconds

/**
 * Executes a function and caches its result in Upstash Redis using a Stale-While-Revalidate pattern.
 * @param {string} key - Unique Redis cache key
 * @param {Function} fetcher - Async function that returns the data to cache
 * @param {number} staleTimeSeconds - Time in seconds before data is considered stale and needs revalidation
 * @param {number} maxCacheTimeSeconds - Maximum time in seconds to keep the data in cache
 * @returns {Promise<any>}
 */
export async function fetchWithSWR(key, fetcher, staleTimeSeconds = 60, maxCacheTimeSeconds = 3600) {
  if (!redis) {
    // If Redis is not configured, just run the fetcher directly
    return await fetcher();
  }

  // Circuit breaker check
  const nowTime = getNow().getTime();
  if (failureCount >= FAILURE_THRESHOLD) {
    if (nowTime - lastFailureTime < RESET_TIMEOUT) {
      // Circuit open, fail-fast
      return await fetcher();
    } else {
      // Half-open, try one request and reset or open again
      failureCount = FAILURE_THRESHOLD - 1; // Allow 1 request through
    }
  }

  try {
    const cachedRecord = await Promise.race([
      redis.get(key),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), 2000))
    ]);
    
    // Reset circuit breaker on success
    failureCount = 0;

    if (cachedRecord && cachedRecord.data !== undefined && cachedRecord.timestamp) {
      const now = getNow().getTime();
      const isStale = (now - cachedRecord.timestamp) > (staleTimeSeconds * 1000);

      if (isStale) {
        // Fire and forget: Revalidate in the background (Stale-While-Revalidate)
        fetcher().then(async (freshData) => {
          await redis.set(key, { data: freshData, timestamp: getNow().getTime() }, { ex: maxCacheTimeSeconds });
        }).catch(err => {
          logger.error(`[SWR_REVALIDATE_ERROR] for key ${key}:`, err);
        });
      }

      // Return stale (or fresh) cached data immediately
      return cachedRecord.data;
    }

    // Cache miss or invalid data: fetch synchronously
    const freshData = await fetcher();
    await Promise.race([
      redis.set(key, { data: freshData, timestamp: getNow().getTime() }, { ex: maxCacheTimeSeconds }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis set timeout')), 2000))
    ]).catch(err => {
        logger.warn(`[SWR_SET_ERROR] for key ${key}:`, err);
    });
    return freshData;

  } catch (error) {
    // Record failure
    failureCount++;
    lastFailureTime = getNow().getTime();
    logger.error(`[SWR_CACHE_ERROR] for key ${key}:`, error);
    // Fallback to fetcher on Redis error
    return await fetcher();
  }
}
