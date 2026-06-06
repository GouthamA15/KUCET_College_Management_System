import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentService } from '@/services/StudentService';
import { db } from '@/db';
import { encrypt, hashForIndex } from '@/lib/encryption';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    query: {
      studentImages: { findFirst: vi.fn() },
      studentSignatures: { findFirst: vi.fn() },
      scholarshipSanctions: { findMany: vi.fn() },
      studentFeePayments: { findMany: vi.fn() },
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
  decrypt: vi.fn((val) => val ? val.replace('encrypted_', '') : null),
}));

describe('StudentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should create new student with full details', async () => {
      const data = {
        roll_no: '22567T0901',
        name: 'Full Test',
        email: 'test@kucet.com',
        pfp: 'data:image/png;base64,123',
        signature: 'data:image/png;base64,456'
      };
      await StudentService.upsertStudent(data, 1);
      expect(mockTx.insert).toHaveBeenCalledTimes(5); // Student, Personal, Academic, Images, Signatures
    });

    it('should update existing student if found', async () => {
        mockTx.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 101 }]) });
        await StudentService.upsertStudent({ roll_no: '22567T0901', name: 'Update' }, 1);
        expect(mockTx.update).toHaveBeenCalled();
    });
  });

  describe('getStudentProfile', () => {
    it('should handle Buffer and string images', async () => {
      const mockJoined = [{
        students: { id: 1, roll_no: '22567T0901', name: 'John' },
        student_personal_details: { id: 1 },
        student_academic_background: null
      }];

      db.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockJoined),
      });

      // Buffer PNG
      db.query.studentImages.findFirst.mockResolvedValue({ pfp: Buffer.from([0x89, 0x50, 0x4E, 0x47]) });
      // Buffer JPEG
      db.query.studentSignatures.findFirst.mockResolvedValue({ signature: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      db.query.scholarshipSanctions.findMany.mockResolvedValue([]);
      db.query.studentFeePayments.findMany.mockResolvedValue([]);

      const profile = await StudentService.getStudentProfile('22567T0901');
      expect(profile.student.pfp).toContain('image/png');
      expect(profile.student.signature).toContain('image/jpeg');
    });

    it('should handle GIF and WEBP', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ students: { id: 1 } }]) });
        
        db.query.studentImages.findFirst.mockResolvedValue({ pfp: Buffer.from([0x47, 0x49, 0x46, 0x38]) });
        let profile = await StudentService.getStudentProfile('X');
        expect(profile.student.pfp).toContain('image/gif');

        db.query.studentImages.findFirst.mockResolvedValue({ pfp: Buffer.from([0x52, 0x49, 0x46, 0x46, 0,0,0,0, 0x57, 0x45, 0x42, 0x50]) });
        profile = await StudentService.getStudentProfile('X');
        expect(profile.student.pfp).toContain('image/webp');
    });
  });

  describe('getStudentsByYearAndBranch', () => {
    it('should query correctly', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) });
        await StudentService.getStudentsByYearAndBranch('2025-26', '09');
        expect(db.select).toHaveBeenCalled();
    });
  });
});
