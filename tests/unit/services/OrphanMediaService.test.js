import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrphanMediaService } from '@/services/archive/OrphanMediaService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  }
}));

vi.mock('@/lib/providers/storage/factory', () => ({
  getStorageProvider: vi.fn(() => ({
    delete: vi.fn().mockResolvedValue(true),
  }))
}));

describe('OrphanMediaService - Storage Cleanup Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockImplementation(() => ({ from: vi.fn().mockResolvedValue([]) }));
  });

  it('should collect set of all active and archived referenced media paths', async () => {
    db.select
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ pfp: 'uploads/pfp/student1.jpg' }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ signature: 'uploads/signatures/sig1.png' }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ pfp: 'uploads/pfp/clerk1.jpg', signature: null }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn().mockResolvedValue([{ path: 'uploads/payments/pay1.png' }]) }));

    const paths = await OrphanMediaService.getReferencedMediaPaths();

    expect(paths.has('uploads/pfp/student1.jpg')).toBe(true);
    expect(paths.has('uploads/signatures/sig1.png')).toBe(true);
    expect(paths.has('uploads/payments/pay1.png')).toBe(true);
  });

  it('should perform orphan media scan in dry-run mode', async () => {
    const result = await OrphanMediaService.scanOrphanMedia({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.orphanCount).toBeGreaterThanOrEqual(0);
  });
});
