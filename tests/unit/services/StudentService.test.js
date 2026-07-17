import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentService } from '@/services/StudentService';
import { db } from '@/db';
import { _encrypt, _hashForIndex } from '@/lib/encryption';

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
      scholarshipWindows: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
  decrypt: vi.fn((val) => val ? val.replace('encrypted_', '') : null),
}));

vi.mock('@/lib/providers/storage/factory', () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    getUrl: vi.fn(val => `mock_url/${val}`)
  })
}));

vi.mock('@/lib/rollNumber', () => ({
  getResolvedCurrentAcademicYear: vi.fn(() => '2025-26'),
  getBranchFromRoll: vi.fn(() => '09')
}));
vi.mock('@/lib/academic-utils', () => ({
  calculateYearAndSemesterAsync: vi.fn().mockResolvedValue({ year: 4, semester: 8 })
}));
vi.mock('@/lib/clock', () => ({
  getNow: vi.fn(() => new Date('2026-06-23T00:00:00Z'))
}));
vi.mock('./FinanceService', () => ({
  FinanceService: { getStudentFinancialSummary: vi.fn().mockResolvedValue({ feeSummary: { pendingFee: 0 } }) }
}));
vi.mock('./ScholarshipService', () => ({
  ScholarshipService: { getScholarshipFinancialSummary: vi.fn().mockResolvedValue({ feeSummary: { pendingFee: 0 } }) }
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
      mockTx.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 1 }]) });
      const data = {
        roll_no: '22567T0901',
        name: 'Full Test',
        email: 'test@kucet.com',
        pfp: 'data:image/png;base64,123',
        signature: 'data:image/png;base64,456',
        perm_house_no: '123'
      };
      await StudentService.upsertStudent(data, 1);
      expect(mockTx.insert).toHaveBeenCalledTimes(5); // Student, Personal, Academic, Images, Signatures
    });

    it('should update existing student if found', async () => {
        mockTx.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 101 }]) });
        await StudentService.upsertStudent({ roll_no: '22567T0901', name: 'Update' }, 1);
        expect(mockTx.insert).toHaveBeenCalled(); // Since upsert now uses onDuplicateKeyUpdate
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

    it('should handle image strings and invalid values', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ students: { id: 1 } }]) });
        db.query.studentImages.findFirst.mockResolvedValue({ pfp: 'image/path.jpg' });
        db.query.studentSignatures.findFirst.mockResolvedValue({ signature: { invalid: true } });
        let profile = await StudentService.getStudentProfile('X');
        expect(profile.student.pfp).toContain('mock_url/image/path.jpg');
        expect(profile.student.signature).toEqual({ invalid: true });
    });

    it('should throw if roll number is empty', async () => {
      await expect(StudentService.getStudentProfile(null)).rejects.toThrow('ROLL_NUMBER_REQUIRED');
    });

    it('should return null if student not found', async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });
      const profile = await StudentService.getStudentProfile('22567T0901');
      expect(profile).toBeNull();
    });
  });

  describe('Normalization methods', () => {
    it('normalizeRollNo', () => {
      expect(StudentService.normalizeRollNo(null)).toBe('');
      expect(StudentService.normalizeRollNo(' 22567t0901 ')).toBe('22567T0901');
    });
    it('normalizeMobile', () => {
      expect(StudentService.normalizeMobile(null)).toBe('');
      expect(StudentService.normalizeMobile('+91 123-456')).toBe('91123456');
    });
    it('normalizeAadhaar', () => {
      expect(StudentService.normalizeAadhaar(null)).toBe('');
      expect(StudentService.normalizeAadhaar('1234 5678 9012')).toBe('123456789012');
    });
  });

  describe('getStudentsByYearAndBranch', () => {
    it('should query correctly', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) });
        await StudentService.getStudentsByYearAndBranch('2025-26', '09');
        expect(db.select).toHaveBeenCalled();
    });

    it('should throw if year or branch is missing', async () => {
      await expect(StudentService.getStudentsByYearAndBranch(null, '09')).rejects.toThrow('Year and branch are required');
      await expect(StudentService.getStudentsByYearAndBranch('2025-26', null)).rejects.toThrow('Year and branch are required');
    });
  });

  describe('getFullStudentDataForExport', () => {
    it('should query and deduplicate records', async () => {
        db.select.mockReturnValue({
            from: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([
                { roll_no: '22567T0901', mobile: 'encrypted_123', aadhaar_no: 'encrypted_123', guardian_mobile: 'encrypted_123' },
                { roll_no: '22567T0901', mobile: 'encrypted_123' }
            ])
        });
        const res = await StudentService.getFullStudentDataForExport('2025-26', '09');
        expect(res).toHaveLength(1);
        expect(res[0].mobile).toBe('123');
    });

    it('should throw if year or branch is missing', async () => {
        await expect(StudentService.getFullStudentDataForExport(null, '09')).rejects.toThrow('Year and branch are required');
    });
  });

  describe('Certificate Eligibility', () => {
    it('should validate Bonafide', async () => {
        db.select.mockReturnValue({
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ total_classes: 10, attended_classes: 8 }])
        });
        const res = await StudentService.validateBonafideEligibility(1, '22567T0901', {}, [], null, new Date());
        expect(res.attendance.total).toBe(10);
        expect(res.isEligible).toBe(true);
    });

    it('should validate TC', async () => {
        const res = await StudentService.validateTCEligibility(1, '22567T0901', {}, [], null, new Date());
        expect(res).toHaveProperty('isEligible');
    });

    it('should fetch all eligibilities', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 1 }]) });
        db.query.students = { findFirst: vi.fn().mockResolvedValue({}) };
        db.query.studentRequests = { findMany: vi.fn().mockResolvedValue([{ certificate_type: 'Bonafide Certificate', academic_year: '2025-26' }]) };
        const res = await StudentService.getCertificateEligibility(1, '22567T0901');
        expect(res.bonafide.isEligible).toBe(false); // Because existingApproved is true
        expect(res.noc.isEligible).toBe(true);
    });
  });

  describe('upsertStudent with tx', () => {
    it('should execute using provided transaction', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 1 }]) }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis(), onDuplicateKeyUpdate: vi.fn().mockResolvedValue({}) })
      };
      await StudentService.upsertStudent({ roll_no: '22567T0901', name: 'John Doe' }, 1, mockTx);
      expect(mockTx.select).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });
});
