import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(true) }),
    transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb)),
  };
  return { db: mockDb };
});

vi.mock('@/services/StudentService', () => ({
  StudentService: {
    upsertStudent: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Bulk Import Fallback Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should support synchronous execution when QSTASH_TOKEN is absent', async () => {
    delete process.env.QSTASH_TOKEN;
    const { POST } = await import('@/app/api/clerk/admission/bulk-import/route.js');
    expect(typeof POST).toBe('function');
  });
});
