import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacultyService } from '@/services/FacultyService';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe('FacultyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentAcademicYear', () => {
    it('should return the latest academic year from the semesters table', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ academic_year: '2022-23' }]),
      };
      db.select.mockReturnValue(mockChain);

      const year = await FacultyService.getCurrentAcademicYear();

      expect(year).toBe('2022-23');
    });

    it('should return a default year if no semesters are found', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      db.select.mockReturnValue(mockChain);

      const year = await FacultyService.getCurrentAcademicYear();
      expect(year).toBe('2025-26');
    });
  });

  describe('getFacultyLoad', () => {
    it('should fetch faculty load metrics', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: 1, name: 'Faculty A', scheduled_weekly: 10, total_conducted: 5, subjects: 'Math' }
        ]),
      };
      db.select.mockReturnValue(mockChain);

      const result = await FacultyService.getFacultyLoad('2025-26');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Faculty A');
    });
  });

  describe('updateMarkAtomic', () => {
    it('should update marks with optimistic locking', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
      };
      db.update.mockReturnValue(mockUpdate);

      const success = await FacultyService.updateMarkAtomic(1, { internal_marks: 20 }, 0);
      expect(success).toBe(true);
    });
  });

  describe('updateTimetableAtomic', () => {
    it('should update timetable with optimistic locking', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
      };
      db.update.mockReturnValue(mockUpdate);

      const success = await FacultyService.updateTimetableAtomic(1, { subject_code: 'CS101' }, 0);
      expect(success).toBe(true);
    });
  });

  describe('getBranchTimetable', () => {
    it('should fetch branch timetable', async () => {
      // Setup mock for getCurrentAcademicYear call inside getBranchTimetable
      const mockYearChain = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ academic_year: '2025-26' }]),
      };
      
      const mockTimetableChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: 1, day_of_week: 'MON' }]),
      };

      // Sequentially return the year chain then the timetable chain
      db.select.mockReturnValueOnce(mockYearChain).mockReturnValueOnce(mockTimetableChain);

      const result = await FacultyService.getBranchTimetable({ branch: 'CSE', semester: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].day_of_week).toBe('MON');
    });
  });
});
