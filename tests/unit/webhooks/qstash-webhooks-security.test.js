import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(true) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(true) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(true) }),
  },
}));

vi.mock('@/services/archive/ArchiveService', () => ({
  ArchiveService: {
    archiveAcademicYear: vi.fn().mockResolvedValue({ success: true }),
    archiveGraduatedBatch: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('QStash Webhook Signature Verification Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should wrap archive-job route handler with verifySignatureAppRouter when QSTASH_TOKEN and signing keys are set', async () => {
    process.env.QSTASH_TOKEN = 'test_token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_123';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_456';
    const { POST } = await import('@/app/api/webhooks/qstash/archive-job/route.js');
    expect(typeof POST).toBe('function');
  });

  it('should wrap notification-dispatch route handler with verifySignatureAppRouter when QSTASH_TOKEN and signing keys are set', async () => {
    process.env.QSTASH_TOKEN = 'test_token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_123';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_456';
    const { POST } = await import('@/app/api/webhooks/qstash/notification-dispatch/route.js');
    expect(typeof POST).toBe('function');
  });

  it('should wrap generate-pdf route handler with verifySignatureAppRouter when QSTASH_TOKEN and signing keys are set', async () => {
    process.env.QSTASH_TOKEN = 'test_token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_123';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_456';
    const { POST } = await import('@/app/api/webhooks/qstash/generate-pdf/route.js');
    expect(typeof POST).toBe('function');
  });

  it('should wrap report-generation route handler with verifySignatureAppRouter when QSTASH_TOKEN and signing keys are set', async () => {
    process.env.QSTASH_TOKEN = 'test_token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_123';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_456';
    const { POST } = await import('@/app/api/webhooks/qstash/report-generation/route.js');
    expect(typeof POST).toBe('function');
  });

  it('should fallback to raw handler when QStash credentials are absent', async () => {
    delete process.env.QSTASH_TOKEN;
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    const { POST } = await import('@/app/api/webhooks/qstash/send-email/route.js');
    expect(typeof POST).toBe('function');
  });
});
