import RealtimeProvider from './RealtimeProvider';
import logger from '@/lib/logger';
import { getBreaker } from '@/lib/utils/CircuitBreaker';

export default class RedisRealtimeProvider extends RealtimeProvider {
  constructor(url) {
    super();
    this.url = url;
    this.redis = null;
    const isDev = process.env.NODE_ENV === 'development';
    this.breaker = getBreaker('RedisRealtime', {
      failureThreshold: isDev ? 2 : 5,
      recoveryTimeout: isDev ? 60000 : 30000,
    });
  }

  async init() {
    if (this.redis) return;
    if (this.url) {
      try {
        const { default: Redis } = await import('ioredis');
        const isDev = process.env.NODE_ENV === 'development';

        this.redis = new Redis(this.url, {
          maxRetriesPerRequest: isDev ? 0 : 3,
          enableOfflineQueue: !isDev,
          connectTimeout: isDev ? 1000 : 10000,
          retryStrategy(times) {
            if (isDev) return null;
            if (times > 10) return null;
            return Math.min(times * 500, 5000);
          },
        });
        this.redis.on('connect', () => logger.info('[REDIS_CONNECTED]'));
        this.redis.on('error', (err) => {
          if (err.code === 'ECONNREFUSED') {
            logger.warn(`[REDIS_OFFLINE] Redis server at ${this.url} is unreachable.`);
          } else {
            logger.error(err, '[REDIS_CONNECTION_ERROR]');
          }
        });
      } catch (err) {
        logger.error(err, '[REDIS_INIT_FAILED]');
      }
    }
  }

  async broadcast(type, payload, options = {}) {
    return await this.breaker.execute(async () => {
      await this.init();
      if (!this.redis) {
        logger.warn('[REDIS_BROADCAST_SKIPPED] Redis not configured');
        return;
      }

      try {
        const rooms = options.rooms || (options.room ? [options.room] : []);
        const data = {
          ...payload,
          event: type,
          type,
          rooms,
          timestamp: Date.now(),
        };

        // 1. Publish to unified real-time channel
        await this.redis.publish('kucet:realtime:events', JSON.stringify(data));

        // 2. Publish to legacy attendance-sync channel for backward compatibility
        await this.redis.publish('attendance-sync', JSON.stringify(data));

        logger.info({ type, rooms }, '[REDIS_BROADCAST_SUCCESS]');
      } catch (err) {
        logger.error(err, '[REDIS_BROADCAST_EXCEPTION]');
        throw err;
      }
    });
  }
}
