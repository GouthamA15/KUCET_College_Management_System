import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '@/services/HealthService';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      constructor() {}
      async ping() {
        if (process.env.MOCK_REDIS_FAIL === 'true') throw new Error('Redis Error');
        return 'PONG';
      }
    }
  };
});

vi.mock('ioredis', () => {
  return {
    default: class MockIORedis {
      constructor(url, options) {
        this.url = url;
        this.options = options;
        this.status = 'wait';
      }
      on() {}
      once() {}
      async connect() {
        if (process.env.MOCK_IOREDIS_CONNECT_FAIL === 'true') {
          throw new Error('Connection refused');
        }
        this.status = 'ready';
      }
      async ping() {
        if (process.env.MOCK_IOREDIS_PING_FAIL === 'true') {
          throw new Error('Timeout ping');
        }
        return 'PONG';
      }
      disconnect() {
        this.status = 'end';
      }
    }
  };
});

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HealthService.resetRedisClient();
    // Set env vars for tests
    delete process.env.REDIS_URL;
    process.env.MOCK_IOREDIS_CONNECT_FAIL = 'false';
    process.env.MOCK_IOREDIS_PING_FAIL = 'false';
    process.env.UPSTASH_REDIS_REST_URL = 'http://mock-redis';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    process.env.BREVO_API_KEY = 'mock-key';
    process.env.EMAIL_USER = 'mock@example.com';
    process.env.MOCK_REDIS_FAIL = 'false';
  });

  describe('checkDatabase', () => {
    it('should return ok if query succeeds', async () => {
      db.execute.mockResolvedValue();
      const result = await HealthService.checkDatabase();
      expect(result.status).toBe('ok');
    });

    it('should return error if query fails', async () => {
      db.execute.mockRejectedValue(new Error('DB Error'));
      const result = await HealthService.checkDatabase();
      expect(result.status).toBe('error');
      expect(result.error).toBe('DB Error');
    });
  });

  describe('checkRedis', () => {
    describe('Self-Hosted Redis (IORedis)', () => {
      it('should return ok for self-hosted redis when REDIS_URL is configured', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('ok');
        expect(result.type).toBe('self-hosted');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });

      it('should reuse persistent client on consecutive checks without reconnecting', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        const res1 = await HealthService.checkRedis();
        expect(res1.status).toBe('ok');
        const res2 = await HealthService.checkRedis();
        expect(res2.status).toBe('ok');
      });

      it('should return error if self-hosted connect fails and reset client', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.MOCK_IOREDIS_CONNECT_FAIL = 'true';
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('error');
        expect(result.error).toBe('Connection refused');
      });

      it('should return error if self-hosted ping fails', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.MOCK_IOREDIS_PING_FAIL = 'true';
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('error');
        expect(result.error).toBe('Timeout ping');
      });
    });

    describe('Upstash Redis fallback', () => {
      it('should return ok if ping returns PONG', async () => {
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('ok');
        expect(result.type).toBe('upstash');
      });

      it('should return not_configured if env vars are missing', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('not_configured');
      });

      it('should return error if ping fails', async () => {
        process.env.MOCK_REDIS_FAIL = 'true';
        const result = await HealthService.checkRedis();
        expect(result.status).toBe('error');
        expect(result.error).toBe('Redis Error');
      });
    });
  });

  describe('checkEmailConfig', () => {
    it('should return configured if credentials exist', () => {
      const result = HealthService.checkEmailConfig();
      expect(result.status).toBe('configured');
    });

    it('should return missing_credentials if env vars are missing', () => {
      delete process.env.BREVO_API_KEY;
      const result = HealthService.checkEmailConfig();
      expect(result.status).toBe('missing_credentials');
    });
  });

  describe('determineStatus', () => {
    it('should return healthy if all are ok', () => {
      const status = HealthService.determineStatus('ok', 'ok', 'configured');
      expect(status).toBe('healthy');
    });

    it('should return unhealthy if any have error', () => {
      const status = HealthService.determineStatus('error', 'ok', 'configured');
      expect(status).toBe('unhealthy');
    });

    it('should return degraded if any have degraded status', () => {
      const status = HealthService.determineStatus('ok', 'degraded', 'configured');
      expect(status).toBe('degraded');
    });

    it('should warn for unknown status', async () => {
      const logger = (await import('@/lib/logger')).default;
      HealthService.determineStatus('unknown');
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unknown' }),
        'Unknown health status'
      );
    });
  });

  describe('isCriticalError', () => {
    it('should return true if DB has error', () => {
      expect(HealthService.isCriticalError('error', 'configured')).toBe(true);
    });

    it('should return true if Email has error', () => {
      expect(HealthService.isCriticalError('ok', 'error')).toBe(true);
    });

    it('should return false if neither is critical', () => {
      expect(HealthService.isCriticalError('ok', 'configured')).toBe(false);
    });
  });
});
