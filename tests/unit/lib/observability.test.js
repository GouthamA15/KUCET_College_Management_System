import { describe, it, expect, vi } from 'vitest';
import { createErrorCorrelationId, formatErrorResponse, logSlowQuery, withPerformanceTracing } from '@/lib/observability';

describe('Enterprise Observability', () => {
  it('should generate error correlation IDs', () => {
    const id = createErrorCorrelationId();
    expect(id).toMatch(/^ERR-/);
  });

  it('should format error responses with correlation ID', () => {
    const res = formatErrorResponse('Database connection failed', 500);
    expect(res.error).toBe('Database connection failed');
    expect(res.statusCode).toBe(500);
    expect(res.correlationId).toBeDefined();
  });

  it('should measure query duration and return result', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const res = await logSlowQuery('getStudents', fetcher, 50);
    expect(res).toEqual([1, 2, 3]);
  });

  it('should trace performance of async handler', async () => {
    const handler = vi.fn().mockResolvedValue({ status: 'ok' });
    const res = await withPerformanceTracing('apiHandler', handler);
    expect(res).toEqual({ status: 'ok' });
  });
});
