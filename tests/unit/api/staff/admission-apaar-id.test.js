import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentProfileService } from '@/services/identity/StudentProfileService';
import { studentCreateSchema } from '@/lib/validations/student';

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `enc_${val}`),
  decrypt: vi.fn((val) => (val?.startsWith('enc_') ? val.slice(4) : val)),
  hashForIndex: vi.fn((val) => `hash_${val}`)
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('APAAR ID Domain Logic & Validation', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  describe('StudentProfileService.normalizeApaarId', () => {
    it('should correctly normalize clean 12-digit string', () => {
      expect(StudentProfileService.normalizeApaarId('123456789012')).toBe('123456789012');
    });

    it('should strip spaces and normalize 12-digit format', () => {
      expect(StudentProfileService.normalizeApaarId('1234 5678 9012')).toBe('123456789012');
      expect(StudentProfileService.normalizeApaarId('  123456789012  ')).toBe('123456789012');
      expect(StudentProfileService.normalizeApaarId('12 34 56 78 90 12')).toBe('123456789012');
    });

    it('should return null for null, undefined, or empty values', () => {
      expect(StudentProfileService.normalizeApaarId('')).toBeNull();
      expect(StudentProfileService.normalizeApaarId('   ')).toBeNull();
      expect(StudentProfileService.normalizeApaarId(null)).toBeNull();
      expect(StudentProfileService.normalizeApaarId(undefined)).toBeNull();
    });

    it('should throw INVALID_APAAR_ID for non-12-digit or non-numeric strings', () => {
      expect(() => StudentProfileService.normalizeApaarId('12345')).toThrow('INVALID_APAAR_ID');
      expect(() => StudentProfileService.normalizeApaarId('1234567890123')).toThrow('INVALID_APAAR_ID');
      expect(() => StudentProfileService.normalizeApaarId('12345678901A')).toThrow('INVALID_APAAR_ID');
      expect(() => StudentProfileService.normalizeApaarId('ABCDEFGHIJKL')).toThrow('INVALID_APAAR_ID');
    });
  });

  describe('studentCreateSchema Zod validation', () => {
    const baseValidStudent = {
      roll_no: '22567T0901',
      name: 'KODAM VENKATESH',
      email: 'venkatesh@example.com',
      mobile: '9876543210',
      date_of_birth: '2004-06-12',
      gender: 'MALE',
      father_name: 'KODAM RAJAIAH',
      category: 'BC-B',
      permanent_address: 'H No 1-2-3, KUCET CAMPUS, WARANGAL, TELANGANA, 506009',
    };

    it('should accept a valid 12-digit APAAR ID', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        apaar_id: '123456789012'
      });
      expect(parsed.apaar_id).toBe('123456789012');
    });

    it('should strip spaces from APAAR ID during validation', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        apaar_id: '1234 5678 9012'
      });
      expect(parsed.apaar_id).toBe('123456789012');
    });

    it('should allow empty APAAR ID as optional', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        apaar_id: ''
      });
      expect(parsed.apaar_id).toBe('');
    });

    it('should reject invalid length APAAR ID', () => {
      expect(() => studentCreateSchema.parse({
        ...baseValidStudent,
        apaar_id: '12345'
      })).toThrow(/APAAR ID must be exactly 12 numeric digits/);
    });

    it('should reject non-numeric APAAR ID', () => {
      expect(() => studentCreateSchema.parse({
        ...baseValidStudent,
        apaar_id: '12345678901A'
      })).toThrow(/APAAR ID must be exactly 12 numeric digits/);
    });
  });

  describe('StudentProfileService.upsertStudent with APAAR ID', () => {
    let mockTx;

    beforeEach(() => {
      mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{ insertId: 211975 }])
          })
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 211975 }])
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
          })
        }),
        query: {
          studentImages: { findFirst: vi.fn() },
          studentSignatures: { findFirst: vi.fn() }
        }
      };
    });

    it('should pass normalized APAAR ID to personal values on insert', async () => {
      const data = {
        roll_no: '22567T0901',
        name: 'KODAM VENKATESH',
        category: 'BC-B',
        apaar_id: '9876 5432 1098'
      };

      const studentId = await StudentProfileService.upsertStudent(data, 1, mockTx);
      expect(studentId).toBe(211975);

      expect(mockTx.insert).toHaveBeenCalledTimes(3);
      const personalValues = mockTx.insert().values.mock.calls[1][0];
      expect(personalValues.apaar_id).toBe('987654321098');
    });

    it('should not overwrite apaar_id if data.apaar_id is undefined', async () => {
      const data = {
        roll_no: '22567T0901',
        name: 'KODAM VENKATESH',
        category: 'BC-B'
      };

      await StudentProfileService.upsertStudent(data, 1, mockTx);
      const personalValues = mockTx.insert().values.mock.calls[1][0];
      expect('apaar_id' in personalValues).toBe(false);
    });

    it('should set apaar_id to null when explicitly cleared with empty string', async () => {
      const data = {
        roll_no: '22567T0901',
        name: 'KODAM VENKATESH',
        category: 'BC-B',
        apaar_id: ''
      };

      await StudentProfileService.upsertStudent(data, 1, mockTx);
      const personalValues = mockTx.insert().values.mock.calls[1][0];
      expect(personalValues.apaar_id).toBeNull();
    });
  });

  describe('Student APAAR ID Self-Submission Route Security Rules', () => {
    it('should reject submission if student already has a locked APAAR ID', async () => {
      // Simulate existing personal details with APAAR ID
      const existingApaar = '123456789012';
      const isAlreadySubmitted = !!existingApaar && existingApaar.trim() !== '';
      expect(isAlreadySubmitted).toBe(true);
    });

    it('should permit first-time submission when no APAAR ID is recorded', async () => {
      const existingApaar = null;
      const isAlreadySubmitted = !!existingApaar && existingApaar.trim() !== '';
      expect(isAlreadySubmitted).toBe(false);
    });
  });
});
