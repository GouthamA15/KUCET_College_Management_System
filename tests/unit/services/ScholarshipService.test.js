import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScholarshipService } from '@/services/ScholarshipService';
import { db } from '@/db';
import { getNow } from '@/lib/clock';

vi.mock('@/db', () => ({
  db: {
    query: {
      scholarshipWindows: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
  },
}));

vi.mock('@/lib/clock', () => ({
  getNow: vi.fn(),
}));

describe('ScholarshipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWindowStatus', () => {
    it('should return CLOSED if no window exists', async () => {
      db.query.scholarshipWindows.findFirst.mockResolvedValue(null);
      const status = await ScholarshipService.getWindowStatus();
      expect(status.status).toBe('CLOSED');
    });

    it('should return OPEN if current date is within window', async () => {
      const mockWindow = {
        start_date: '2026-06-01',
        end_date: '2026-06-30',
      };
      db.query.scholarshipWindows.findFirst.mockResolvedValue(mockWindow);
      getNow.mockResolvedValue(new Date('2026-06-15T10:00:00Z'));

      const status = await ScholarshipService.getWindowStatus();
      expect(status.status).toBe('OPEN');
      expect(status.startDate).toBe('2026-06-01');
    });

    it('should return CLOSED if current date is before window', async () => {
      const mockWindow = {
        start_date: '2026-07-01',
        end_date: '2026-07-31',
      };
      db.query.scholarshipWindows.findFirst.mockResolvedValue(mockWindow);
      getNow.mockResolvedValue(new Date('2026-06-15T10:00:00Z'));

      const status = await ScholarshipService.getWindowStatus();
      expect(status.status).toBe('CLOSED');
    });
  });

  describe('getMetrics', () => {
    it('should fetch aggregate metrics correctly', async () => {
      const mockWindow = { start_date: '2026-06-01', end_date: '2026-06-30' };
      db.query.scholarshipWindows.findFirst.mockResolvedValue(mockWindow);
      getNow.mockResolvedValue(new Date('2026-06-15'));

      const mockCount = [{ count: 5 }];
      const chainable = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
        then: vi.fn((resolve) => resolve(mockCount))
      };
      db.select.mockReturnValue(chainable);

      const metrics = await ScholarshipService.getMetrics();
      expect(metrics.totalRecords).toBe(5);
      expect(metrics.windowStatus).toBe('OPEN');
    });
  });
});
