import RealtimeProvider from './RealtimeProvider';
import logger from '@/lib/logger';
import { getBreaker } from '@/lib/utils/CircuitBreaker';

export default class RedisRealtimeProvider extends RealtimeProvider {
  constructor(url) {
    super();
    this.url = url;
    this.redis = null;
    this.breaker = getBreaker('RedisRealtime');
  }

  async init() {
    if (this.redis) return;
    if (this.url) {
      try {
        const { default: Redis } = await import('ioredis');
        this.redis = new Redis(this.url);
        this.redis.on('connect', () => logger.info('[REDIS_CONNECTED]'));
        this.redis.on('error', (err) => logger.error(err, '[REDIS_CONNECTION_ERROR]'));
      } catch (err) {
        logger.error(err, '[REDIS_INIT_FAILED]');
      }
    }
  }

  async broadcast(type, payload) {
    return await this.breaker.execute(async () => {
      await this.init();
      if (!this.redis) {
        logger.warn('[REDIS_BROADCAST_SKIPPED] Redis not configured');
        return;
      }

      try {
        const data = {
          ...payload,
          type,
          timestamp: Date.now()
        };
        await this.redis.publish('attendance-sync', JSON.stringify(data));
        logger.info({ type }, '[REDIS_BROADCAST_SUCCESS]');
      } catch (err) {
        logger.error(err, '[REDIS_BROADCAST_EXCEPTION]');
        throw err; // Re-throw for circuit breaker
      }
    });
  }
}
