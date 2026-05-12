import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacultyService } from '@/services/FacultyService';
import { db } from '@/db';
import { semesters, clerks } from '@/db/schema';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('FacultyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentAcademicYear', () => {
    it('should return the latest academic year from the semesters table', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ academic_year: '2022-23' }]),
      };
      db.select.mockReturnValue(mockSelect);

      const year = await FacultyService.getCurrentAcademicYear();

      expect(db.select).toHaveBeenCalled();
      expect(year).toBe('2022-23');
    });

    it('should return a default year if no semesters are found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      db.select.mockReturnValue(mockSelect);

      const year = await FacultyService.getCurrentAcademicYear();

      expect(year).toBe('2025-26');
    });
  });

  describe('getFacultyLoad', () => {
    it('should fetch faculty load metrics with complex SQL expressions', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: 1, name: 'Faculty A', scheduled_weekly: 10, total_conducted: 5, subjects: 'Math, Science' }
        ]),
      };
      db.select.mockReturnValue(mockSelect);

      const result = await FacultyService.getFacultyLoad('2025-26');

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Faculty A');
    });
  });
});
