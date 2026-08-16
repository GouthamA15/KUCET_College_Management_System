import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@upstash/qstash', () => {
  return {
    Client: class {
      publishJSON() {
        return Promise.resolve({ messageId: 'msg_test_123' });
      }
    },
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Queue Base URL Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use NEXT_PUBLIC_BASE_URL when present', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://kucet.ac.in';
    process.env.QSTASH_TOKEN = 'test_token';

    const { enqueueJob } = await import('@/lib/queue');
    const result = await enqueueJob('/api/webhooks/qstash/send-email', { test: true });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ messageId: 'msg_test_123' });
  });

  it('should strip trailing slashes to avoid double slashes in webhook URLs', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://kucet.ac.in///';
    process.env.QSTASH_TOKEN = 'test_token';

    const { enqueueJob } = await import('@/lib/queue');
    const result = await enqueueJob('/api/webhooks/qstash/send-email', { test: true });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ messageId: 'msg_test_123' });
  });

  it('should return null when QSTASH_TOKEN is absent', async () => {
    delete process.env.QSTASH_TOKEN;
    const { enqueueJob } = await import('@/lib/queue');
    const result = await enqueueJob('/api/webhooks/qstash/send-email', { test: true });
    expect(result).toBeNull();
  });
});
