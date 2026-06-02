import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '@/services/ValidationService';
import { db } from '@/db';

// Helper to create a chainable mock for Drizzle select
const createChainableMock = (returnValue) => {
  const mock = {
    innerJoin: vi.fn(() => mock),
    where: vi.fn(() => mock),
    limit: vi.fn(() => mock),
    then: vi.fn((resolve) => resolve(returnValue)),
    // Support async/await by implementing catch and finally too
    catch: vi.fn(),
    finally: vi.fn(),
  };
  return mock;
};

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => createChainableMock([{ count: 0 }]))
    }))
  }
}));

describe('ValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkBranchDependencies', () => {
    it('should return canDelete: true if no dependencies exist', async () => {
      const result = await ValidationService.checkBranchDependencies('CSE');
      expect(result.canDelete).toBe(true);
    });

    it('should return canDelete: false if students are assigned', async () => {
      db.select.mockReturnValueOnce({
        from: () => createChainableMock([{ count: 5 }])
      });
      
      const result = await ValidationService.checkBranchDependencies('CSE');
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('5 students');
    });
  });

  describe('checkSubjectDependencies', () => {
    it('should return canDelete: true if no dependencies exist', async () => {
      const result = await ValidationService.checkSubjectDependencies('CS101');
      expect(result.canDelete).toBe(true);
    });

    it('should return canDelete: false if marks exist', async () => {
      db.select.mockReturnValueOnce({
        from: () => createChainableMock([{ count: 10 }])
      });
      
      const result = await ValidationService.checkSubjectDependencies('CS101');
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('10 student mark records');
    });

    it('should return canDelete: false if scheduled in timetable', async () => {
      db.select.mockReturnValueOnce({ from: () => createChainableMock([{ count: 0 }]) }); // marks
      db.select.mockReturnValueOnce({ from: () => createChainableMock([{ count: 3 }]) }); // timetable
      
      const result = await ValidationService.checkSubjectDependencies('CS101');
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('3 timetable slots');
    });
  });

  describe('checkSubjectBranchDependencies', () => {
    it('should return canDelete: true if no branch-specific dependencies exist', async () => {
      const result = await ValidationService.checkSubjectBranchDependencies('CS101', 'CSE');
      expect(result.canDelete).toBe(true);
    });

    it('should return canDelete: false if branch marks exist', async () => {
      db.select.mockReturnValueOnce({
        from: () => createChainableMock([{ count: 2 }])
      });
      const result = await ValidationService.checkSubjectBranchDependencies('CS101', 'CSE');
      expect(result.canDelete).toBe(false);
    });
  });
});
