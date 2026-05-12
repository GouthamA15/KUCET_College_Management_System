import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentService } from '@/services/StudentService';
import { db } from '@/db';
import { students as studentsTable } from '@/db/schema';
import { encrypt, hashForIndex } from '@/lib/encryption';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
}));

describe('StudentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStudentsByYearAndBranch', () => {
    it('should throw an error if year or branch is missing', async () => {
      await expect(StudentService.getStudentsByYearAndBranch(null, 'CSE'))
        .rejects.toThrow('Year and branch are required');
    });

    it('should call db.select with correct patterns', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 1, roll_no: '22567T0901' }]),
      };
      db.select.mockReturnValue(mockSelect);

      const result = await StudentService.getStudentsByYearAndBranch('2022-23', '09');

      expect(db.select).toHaveBeenCalled();
      expect(mockSelect.from).toHaveBeenCalledWith(studentsTable);
      expect(result).toHaveLength(1);
    });
  });

  describe('createStudent', () => {
    it('should throw an error if roll_no or name is missing', async () => {
      await expect(StudentService.createStudent({}, 1))
        .rejects.toThrow('Roll number and name are required');
    });

    it('should create a student within a transaction', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue([{ insertId: 101 }]),
      };
      db.transaction.mockImplementation(async (cb) => cb(mockTx));

      const studentData = {
        roll_no: '22567T0901',
        name: 'John Doe',
        mobile: '9876543210',
        aadhaar_no: '123456789012',
        qualifying_exam: 'EAMCET'
      };

      const resultId = await StudentService.createStudent(studentData, 1);

      expect(db.transaction).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledTimes(3); // students, personal, academic
      expect(encrypt).toHaveBeenCalledWith('9876543210');
      expect(hashForIndex).toHaveBeenCalledWith('123456789012');
      expect(resultId).toBe(101);
    });

    it('should skip academic background if qualifying_exam is missing', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue([{ insertId: 102 }]),
      };
      db.transaction.mockImplementation(async (cb) => cb(mockTx));

      const studentData = {
        roll_no: '22567T0902',
        name: 'Jane Doe',
      };

      await StudentService.createStudent(studentData, 1);

      expect(mockTx.insert).toHaveBeenCalledTimes(2); // only students and personal
    });
  });
});
