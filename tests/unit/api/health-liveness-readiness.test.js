import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { HealthService } from '@/services/shared/HealthService';
import { GET } from '@/app/api/health/route';
import { db } from '@/db';

describe('Health Checks: Liveness, Readiness & Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HealthService Unit Methods', () => {
    it('getLiveness returns alive status and process uptime', () => {
      const liveness = HealthService.getLiveness();
      expect(liveness.status).toBe('alive');
      expect(typeof liveness.uptimeSeconds).toBe('number');
      expect(liveness.timestamp).toBeDefined();
    });

    it('getReadiness returns ready when database check succeeds', async () => {
      db.execute.mockResolvedValueOnce([[{ '1': 1 }]]);
      const readiness = await HealthService.getReadiness();
      expect(readiness.ready).toBe(true);
      expect(readiness.status).toBe('ready');
      expect(readiness.components.database.status).toBe('ok');
    });

    it('getReadiness returns unhealthy when database check fails', async () => {
      db.execute.mockRejectedValueOnce(new Error('Connection refused'));
      const readiness = await HealthService.getReadiness();
      expect(readiness.ready).toBe(false);
      expect(readiness.status).toBe('unhealthy');
      expect(readiness.components.database.status).toBe('error');
    });

    it('determineStatus returns degraded (not unhealthy) when Redis or Email blips but DB is ok', () => {
      const statusRedisError = HealthService.determineStatus('ok', 'error', 'configured');
      expect(statusRedisError).toBe('degraded');

      const statusEmailError = HealthService.determineStatus('ok', 'ok', 'error');
      expect(statusEmailError).toBe('degraded');

      const statusBothDegraded = HealthService.determineStatus('ok', 'degraded', 'missing_credentials');
      expect(statusBothDegraded).toBe('degraded');
    });

    it('determineStatus returns unhealthy only when database is down', () => {
      const status = HealthService.determineStatus('error', 'ok', 'configured');
      expect(status).toBe('unhealthy');
    });

    it('determineStatus returns healthy when all services are ok', () => {
      const status = HealthService.determineStatus('ok', 'ok', 'configured');
      expect(status).toBe('healthy');
    });
  });

  describe('GET /api/health Route Behavior', () => {
    it('handles ?type=liveness without calling database', async () => {
      const req = new Request('http://localhost/api/health?type=liveness');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('alive');
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('handles ?type=readiness returning 200 when database succeeds', async () => {
      db.execute.mockResolvedValueOnce([[{ '1': 1 }]]);
      const req = new Request('http://localhost/api/health?type=readiness');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ready).toBe(true);
      expect(json.status).toBe('ready');
    });

    it('handles ?type=readiness returning 503 when database fails', async () => {
      db.execute.mockRejectedValueOnce(new Error('DB unreachable'));
      const req = new Request('http://localhost/api/health?type=readiness');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.ready).toBe(false);
      expect(json.status).toBe('unhealthy');
    });

    it('handles full diagnostics returning 200 (degraded) when DB is ok even if Redis is failing', async () => {
      db.execute.mockResolvedValueOnce([[{ '1': 1 }]]);
      vi.spyOn(HealthService, 'checkRedis').mockResolvedValueOnce({ status: 'error', latencyMs: -1, error: 'Redis down' });
      vi.spyOn(HealthService, 'checkStorage').mockResolvedValueOnce({ status: 'ok', latencyMs: 5 });

      const req = new Request('http://localhost/api/health');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('degraded');
      expect(json.components.database.status).toBe('ok');
      expect(json.components.redis.status).toBe('error');
    });
  });
});
