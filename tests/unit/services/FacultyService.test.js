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
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
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
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
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
      const mockFacultyChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 1, name: 'Faculty A', email: 'a@test.com', home_branch: 'CSE' },
          { id: 2, name: 'Faculty B', email: 'b@test.com', home_branch: 'CSE' },
          { id: 3, name: 'Faculty C', email: 'c@test.com', home_branch: 'CSE' }
        ]),
      };
      const mockScheduledChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([
          { faculty_id: 1, count: 10 },
          { faculty_id: 2, count: 20 },
          { faculty_id: 3, count: 10 }
        ]),
      };
      const mockConductedChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([
          { faculty_id: 1, count: 5 }
        ]),
      };
      const mockSubjectsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([
          { faculty_id: 1, subjects: 'Math' }
        ]),
      };

      db.select
        .mockReturnValueOnce(mockFacultyChain)
        .mockReturnValueOnce(mockScheduledChain)
        .mockReturnValueOnce(mockConductedChain)
        .mockReturnValueOnce(mockSubjectsChain);

      const result = await FacultyService.getFacultyLoad('2025-26');
      expect(result).toHaveLength(3);
      // Expected order: B (20), A (10), C (10)
      expect(result[0].name).toBe('Faculty B');
      expect(result[0].scheduled_weekly).toBe(20);
      expect(result[1].name).toBe('Faculty A');
      expect(result[1].scheduled_weekly).toBe(10);
      expect(result[2].name).toBe('Faculty C');
      expect(result[2].scheduled_weekly).toBe(10);
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
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ academic_year: '2025-26' }]),
      };
      
      const mockTimetableChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
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

    it('should fetch branch timetable with section and academicYear provided', async () => {
      const mockTimetableChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: 1, day_of_week: 'TUE' }]),
      };

      db.select.mockReturnValueOnce(mockTimetableChain);

      const result = await FacultyService.getBranchTimetable({ branch: 'CSE', semester: 1, section: 'A', academicYear: '2025-26' });
      expect(result).toHaveLength(1);
      expect(result[0].day_of_week).toBe('TUE');
    });
  });
});
