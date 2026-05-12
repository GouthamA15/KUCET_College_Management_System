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

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for tests
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
    it('should return ok if ping returns PONG', async () => {
      const result = await HealthService.checkRedis();
      expect(result.status).toBe('ok');
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
