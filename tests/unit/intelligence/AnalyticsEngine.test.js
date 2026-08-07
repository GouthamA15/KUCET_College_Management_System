import { describe, it, expect, vi } from 'vitest';
import { analyticsEngine } from '@/intelligence/analytics';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis()
  }
}));

vi.mock('@/lib/cache', () => ({
  cacheAside: vi.fn(async (key, fetcher) => await fetcher())
}));

describe('AnalyticsEngine', () => {
  describe('StudentAnalytics', () => {
    it('should return getStudentSummary structure', async () => {
      // Mock db response
      const mockResult = [{ week: 1, present: 5, total: 5 }];
      const dbSelect = (await import('@/db')).db.select;
      dbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockResult)
            })
          })
        })
      });
      
      const summary = await analyticsEngine.students.getStudentSummary(1, '2023-2024');
      expect(summary).toHaveProperty('attendance');
      expect(summary).toHaveProperty('marks');
    });
  });

  describe('DepartmentAnalytics', () => {
    it('should have getAttendancePercentage method', async () => {
      const stats = await analyticsEngine.departments.getAttendancePercentage('CSE', {});
      expect(stats).toBeDefined();
    });
  });

  describe('InstitutionAnalytics', () => {
    it('should have correct structure for getInstitutionSummary', async () => {
      const summary = await analyticsEngine.institution.getInstitutionSummary('2023-2024');
      expect(summary).toHaveProperty('activeStudents');
      expect(summary).toHaveProperty('alumni');
    });
  });
});
