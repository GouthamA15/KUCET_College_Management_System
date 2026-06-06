import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentService } from '@/services/StudentService';
import { db } from '@/db';
import { students as studentsTable, studentPersonalDetails, studentAcademicBackground } from '@/db/schema';
import { encrypt, hashForIndex } from '@/lib/encryption';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
  decrypt: vi.fn((val) => val.replace('encrypted_', '')),
}));

describe('StudentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeRollNo', () => {
    it('should trim and uppercase roll numbers', () => {
      expect(StudentService.normalizeRollNo(' 22567t0901 ')).toBe('22567T0901');
    });
  });

  describe('normalizeMobile', () => {
    it('should strip non-numeric characters', () => {
      expect(StudentService.normalizeMobile('+91 98765-43210')).toBe('919876543210');
    });
  });

  describe('upsertStudent', () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn((cb) => cb(mockTx)),
    };

    beforeEach(() => {
      db.transaction.mockImplementation((cb) => cb(mockTx));
      
      const chainable = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve([{ insertId: 101, affectedRows: 1 }]))
      };

      mockTx.select.mockReturnValue(chainable);
      mockTx.insert.mockReturnValue(chainable);
      mockTx.update.mockReturnValue(chainable);
    });

    it('should throw an error if roll_no or name is missing', async () => {
      await expect(StudentService.upsertStudent({}, 1))
        .rejects.toThrow('MISSING_REQUIRED_FIELDS');
    });

    it('should create a new student when no record exists', async () => {
      const studentData = {
        roll_no: '22567T0901',
        name: 'John Doe',
        mobile: '9876543210',
        qualifying_exam: 'TG EAPCET'
      };

      const resultId = await StudentService.upsertStudent(studentData, 1);

      expect(resultId).toBe(101);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(encrypt).toHaveBeenCalledWith('9876543210');
    });

    it('should update an existing student if roll_no matches', async () => {
      mockTx.select.mockReturnValueOnce({ 
        from: vi.fn().mockReturnThis(), 
        where: vi.fn().mockReturnThis(), 
        limit: vi.fn().mockResolvedValue([{ id: 101 }]) 
      });

      const studentData = {
        roll_no: '22567T0901',
        name: 'John Updated',
      };

      await StudentService.upsertStudent(studentData, 1);

      expect(mockTx.update).toHaveBeenCalled();
    });

    it('should handle academic background only if provided', async () => {
      const studentData = {
        roll_no: '22567T0902',
        name: 'Jane Doe',
      };

      await StudentService.upsertStudent(studentData, 1);

      // Core, Personal, Academic (even if empty values, structure is created)
      expect(mockTx.insert).toHaveBeenCalledTimes(3); 
    });
  });
});
