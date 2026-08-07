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

// In-memory fallback for local testing / unconfigured Redis
const inMemoryCache = new Map();
const tagRegistry = new Map();

// Circuit Breaker state
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 30000; // 30 seconds

export const CACHE_KEYS = Object.freeze({
  COLLEGE_CONFIG: 'config:college',
  ACADEMIC_CALENDAR: 'academic:calendar',
  TIMETABLE: (branch, sem) => `academic:timetable:${branch}:${sem}`,
  DEPT_CONFIG: (branch) => `config:dept:${branch}`,
  SUBJECT_STRUCTURE: (branch, sem) => `academic:subjects:${branch}:${sem}`,
  FEE_STRUCTURES: 'finance:fee_structures',
  SYSTEM_CONFIG: 'config:system',
});

/**
 * Cache-Aside helper with TTL and Tag support
 */
export async function cacheAside(key, fetcher, options = {}) {
  const { ttl = 3600, tags = [] } = options;

  if (!redis) {
    if (inMemoryCache.has(key)) {
      const cached = inMemoryCache.get(key);
      if (cached.expiresAt > Date.now()) {
        return cached.data;
      }
      inMemoryCache.delete(key);
    }

    const freshData = await fetcher();
    inMemoryCache.set(key, { data: freshData, expiresAt: Date.now() + ttl * 1000 });
    tags.forEach((tag) => {
      if (!tagRegistry.has(tag)) tagRegistry.set(tag, new Set());
      tagRegistry.get(tag).add(key);
    });
    return freshData;
  }

  try {
    const cachedData = await redis.get(key);
    if (cachedData !== null && cachedData !== undefined) {
      return cachedData;
    }

    const freshData = await fetcher();
    await redis.set(key, freshData, { ex: ttl });

    // Track tags
    for (const tag of tags) {
      await redis.sadd(`tag:${tag}`, key);
      await redis.expire(`tag:${tag}`, ttl + 3600);
    }

    return freshData;
  } catch (err) {
    logger.warn({ err, key }, '[CacheAside] Failed Redis lookup, falling back to fetcher');
    return await fetcher();
  }
}

/**
 * Invalidates a specific cache key
 */
export async function invalidateKey(key) {
  inMemoryCache.delete(key);
  if (!redis) return true;

  try {
    await redis.del(key);
    return true;
  } catch (err) {
    logger.warn({ err, key }, '[Cache] Invalidate key failed');
    return false;
  }
}

/**
 * Invalidates all keys associated with a given tag
 */
export async function invalidateTag(tag) {
  if (tagRegistry.has(tag)) {
    const keys = tagRegistry.get(tag);
    keys.forEach((key) => inMemoryCache.delete(key));
    tagRegistry.delete(tag);
  }

  if (!redis) return true;

  try {
    const tagKey = `tag:${tag}`;
    const keys = await redis.smembers(tagKey);
    if (Array.isArray(keys) && keys.length > 0) {
      await Promise.all(keys.map((k) => redis.del(k)));
    }
    await redis.del(tagKey);
    return true;
  } catch (err) {
    logger.warn({ err, tag }, '[Cache] Invalidate tag failed');
    return false;
  }
}

/**
 * Executes a function and caches its result in Upstash Redis using a Stale-While-Revalidate pattern.
 */
export async function fetchWithSWR(key, fetcher, staleTimeSeconds = 60, maxCacheTimeSeconds = 3600) {
  if (!redis) {
    return await fetcher();
  }

  const nowTime = getNow().getTime();
  if (failureCount >= FAILURE_THRESHOLD) {
    if (nowTime - lastFailureTime < RESET_TIMEOUT) {
      return await fetcher();
    } else {
      failureCount = FAILURE_THRESHOLD - 1;
    }
  }

  try {
    const cachedRecord = await Promise.race([
      redis.get(key),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), 2000)),
    ]);

    failureCount = 0;

    if (cachedRecord && cachedRecord.data !== undefined && cachedRecord.timestamp) {
      const now = getNow().getTime();
      const isStale = now - cachedRecord.timestamp > staleTimeSeconds * 1000;

      if (isStale) {
        fetcher()
          .then(async (freshData) => {
            await redis.set(key, { data: freshData, timestamp: getNow().getTime() }, { ex: maxCacheTimeSeconds });
          })
          .catch((err) => {
            logger.error(`[SWR_REVALIDATE_ERROR] for key ${key}:`, err);
          });
      }

      return cachedRecord.data;
    }

    const freshData = await fetcher();
    await Promise.race([
      redis.set(key, { data: freshData, timestamp: getNow().getTime() }, { ex: maxCacheTimeSeconds }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis set timeout')), 2000)),
    ]).catch((err) => {
      logger.warn(`[SWR_SET_ERROR] for key ${key}:`, err);
    });
    return freshData;
  } catch (error) {
    failureCount++;
    lastFailureTime = getNow().getTime();
    logger.error(`[SWR_CACHE_ERROR] for key ${key}:`, error);
    return await fetcher();
  }
}
