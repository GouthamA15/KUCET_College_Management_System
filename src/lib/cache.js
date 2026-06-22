import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

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

  try {
    const cachedRecord = await redis.get(key);

    if (cachedRecord && cachedRecord.data !== undefined && cachedRecord.timestamp) {
      const now = Date.now();
      const isStale = (now - cachedRecord.timestamp) > (staleTimeSeconds * 1000);

      if (isStale) {
        // Fire and forget: Revalidate in the background (Stale-While-Revalidate)
        fetcher().then(async (freshData) => {
          await redis.set(key, { data: freshData, timestamp: Date.now() }, { ex: maxCacheTimeSeconds });
        }).catch(err => {
          logger.error(`[SWR_REVALIDATE_ERROR] for key ${key}:`, err);
        });
      }

      // Return stale (or fresh) cached data immediately
      return cachedRecord.data;
    }

    // Cache miss or invalid data: fetch synchronously
    const freshData = await fetcher();
    await redis.set(key, { data: freshData, timestamp: Date.now() }, { ex: maxCacheTimeSeconds });
    return freshData;

  } catch (error) {
    logger.error(`[SWR_CACHE_ERROR] for key ${key}:`, error);
    // Fallback to fetcher on Redis error
    return await fetcher();
  }
}
