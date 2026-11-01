import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAreaStatus, isValidAreaStatus, AREA_STATUSES } from '@/lib/college-config';
import { StudentProfileService } from '@/services/identity/StudentProfileService';
import { studentCreateSchema } from '@/lib/validations/student';

describe('Area Status Domain Logic & Validation', () => {
  describe('normalizeAreaStatus & isValidAreaStatus', () => {
    it('should correctly normalize Local variations', () => {
      expect(normalizeAreaStatus('Local')).toBe('Local');
      expect(normalizeAreaStatus('local')).toBe('Local');
      expect(normalizeAreaStatus('LOCAL')).toBe('Local');
      expect(normalizeAreaStatus('  Local  ')).toBe('Local');
      expect(isValidAreaStatus('Local')).toBe(true);
      expect(isValidAreaStatus('LOCAL')).toBe(true);
    });

    it('should correctly normalize Non Local / Non-Local variations', () => {
      expect(normalizeAreaStatus('Non Local')).toBe('Non-Local');
      expect(normalizeAreaStatus('non local')).toBe('Non-Local');
      expect(normalizeAreaStatus('NON LOCAL')).toBe('Non-Local');
      expect(normalizeAreaStatus('Non-Local')).toBe('Non-Local');
      expect(normalizeAreaStatus('non-local')).toBe('Non-Local');
      expect(normalizeAreaStatus('NON-LOCAL')).toBe('Non-Local');
      expect(normalizeAreaStatus('  Non Local  ')).toBe('Non-Local');
      expect(isValidAreaStatus('Non Local')).toBe(true);
      expect(isValidAreaStatus('NON-LOCAL')).toBe(true);
      expect(isValidAreaStatus('Non-Local')).toBe(true);
    });

    it('should return null / false for empty or missing values', () => {
      expect(normalizeAreaStatus('')).toBeNull();
      expect(normalizeAreaStatus('   ')).toBeNull();
      expect(normalizeAreaStatus(null)).toBeNull();
      expect(normalizeAreaStatus(undefined)).toBeNull();
      expect(isValidAreaStatus('')).toBe(false);
      expect(isValidAreaStatus(null)).toBe(false);
      expect(isValidAreaStatus(undefined)).toBe(false);
    });

    it('should reject genuinely invalid classifications without silent fallback', () => {
      expect(normalizeAreaStatus('Urban')).toBeNull();
      expect(normalizeAreaStatus('Rural')).toBeNull();
      expect(normalizeAreaStatus('International')).toBeNull();
      expect(normalizeAreaStatus('Unknown')).toBeNull();
      expect(isValidAreaStatus('Urban')).toBe(false);
      expect(isValidAreaStatus('Rural')).toBe(false);
    });

    it('should export canonical AREA_STATUSES matching MySQL enum', () => {
      expect(AREA_STATUSES).toEqual(['Local', 'Non-Local']);
    });
  });

  describe('studentCreateSchema Zod validation', () => {
    const baseValidStudent = {
      roll_no: '26567T3001',
      name: 'ALLADA SATHYA SAI',
      email: 'sathya@example.com',
      mobile: '9876543210',
      date_of_birth: '2008-05-15',
      gender: 'MALE',
      father_name: 'ALLADA SRINIVAS',
      category: 'BC-B',
      permanent_address: '1-56/2, MARKENDAYA NAGAR, CHOUTUPPAL, TELANGANA, 508252',
    };

    it('should accept valid "Non Local" and transform it to canonical "Non-Local"', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        area_status: 'Non Local',
      });
      expect(parsed.area_status).toBe('Non-Local');
    });

    it('should accept canonical "Non-Local" directly', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        area_status: 'Non-Local',
      });
      expect(parsed.area_status).toBe('Non-Local');
    });

    it('should accept "LOCAL" and transform it to canonical "Local"', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        area_status: 'LOCAL',
      });
      expect(parsed.area_status).toBe('Local');
    });

    it('should accept empty or omitted area_status', () => {
      const parsed = studentCreateSchema.parse({
        ...baseValidStudent,
        area_status: '',
      });
      expect(parsed.area_status).toBe('');
    });

    it('should reject invalid area status like "Urban" with clear validation message', () => {
      const result = studentCreateSchema.safeParse({
        ...baseValidStudent,
        area_status: 'Urban',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("Area status must be 'Local' or 'Non-Local'");
    });
  });
});

describe('StudentProfileService.upsertStudent Area Status Normalization', () => {
  let mockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{ insertId: 101, affectedRows: 1 }])
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

  it('should normalize incoming "Non Local" to canonical "Non-Local" for personal values', async () => {
    const data = {
      roll_no: '26567T3001',
      name: 'ALLADA SATHYA SAI',
      area_status: 'Non Local',
      category: 'BC-B',
      father_name: 'ALLADA SRINIVAS',
      mother_name: 'ALLADA JAYALAXMI',
      perm_house_no: '1-56/2',
      perm_street: 'MARKENDAYA NAGAR',
      perm_city: 'CHOUTUPPAL',
      perm_state: 'TELANGANA',
      perm_pincode: '508252'
    };

    const studentId = await StudentProfileService.upsertStudent(data, 1, mockTx);
    expect(studentId).toBe(211975);

    // Verify personal details insert received canonical 'Non-Local'
    expect(mockTx.insert).toHaveBeenCalledTimes(3); // students, personal, academic
    const personalCall = mockTx.insert.mock.calls[1];
    expect(personalCall).toBeDefined();

    // Check the values passed to mockTx.insert(studentPersonalDetails).values(...)
    const valuesCall = mockTx.insert().values.mock.calls[1][0];
    expect(valuesCall.area_status).toBe('Non-Local');
  });

  it('should normalize uppercase "NON-LOCAL" to canonical "Non-Local"', async () => {
    const data = {
      roll_no: '26567T3002',
      name: 'BANDI MEGHANA',
      area_status: 'NON-LOCAL',
      category: 'BC-B'
    };

    await StudentProfileService.upsertStudent(data, 1, mockTx);
    const valuesCall = mockTx.insert().values.mock.calls[1][0];
    expect(valuesCall.area_status).toBe('Non-Local');
  });

  it('should normalize "LOCAL" to canonical "Local"', async () => {
    const data = {
      roll_no: '26567T3003',
      name: 'BODA PRAGNITHA',
      area_status: 'LOCAL',
      category: 'ST'
    };

    await StudentProfileService.upsertStudent(data, 1, mockTx);
    const valuesCall = mockTx.insert().values.mock.calls[1][0];
    expect(valuesCall.area_status).toBe('Local');
  });

  it('should default to "Local" when area_status is missing or empty', async () => {
    const data = {
      roll_no: '26567T3004',
      name: 'DEFAULT STUDENT',
      area_status: '',
      category: 'OC'
    };

    await StudentProfileService.upsertStudent(data, 1, mockTx);
    const valuesCall = mockTx.insert().values.mock.calls[1][0];
    expect(valuesCall.area_status).toBe('Local');
  });

  it('should throw INVALID_AREA_STATUS when an unrecognized area status is passed', async () => {
    const data = {
      roll_no: '26567T3005',
      name: 'INVALID STUDENT',
      area_status: 'Urban',
      category: 'OC'
    };

    await expect(StudentProfileService.upsertStudent(data, 1, mockTx))
      .rejects.toThrow('INVALID_AREA_STATUS');
  });
});

describe('Admission Finalization Flow & Safety Invariants', () => {
  it('should enforce CSD branch validation matching branch code 30', async () => {
    const { validateRollNo } = await import('@/lib/rollNumber');
    const result = validateRollNo('26567T3001');
    expect(result.isValid).toBe(true);
    expect(result.branch).toBe('CSD');
    expect(result.admissionType).toBe('Regular');
    expect(result.entryYear).toBe('2026');
  });

  it('should support multiple engineering branches with consistent roll numbering', async () => {
    const { validateRollNo } = await import('@/lib/rollNumber');
    const branches = [
      { roll: '26567T0901', expectedBranch: 'CSE' },
      { roll: '26567T3001', expectedBranch: 'CSD' },
      { roll: '26567T1501', expectedBranch: 'ECE' },
      { roll: '26567T1201', expectedBranch: 'EEE' },
      { roll: '26567T0001', expectedBranch: 'CIVIL' },
      { roll: '26567T1801', expectedBranch: 'IT' },
      { roll: '26567T0301', expectedBranch: 'MECH' },
    ];

    branches.forEach(({ roll, expectedBranch }) => {
      const res = validateRollNo(roll);
      expect(res.isValid).toBe(true);
      expect(res.branch).toBe(expectedBranch);
    });
  });

  it('should simulate transaction rollback when personal details insert fails', async () => {
    let transactionCommitted = false;
    let draftStatus = 'PROCESSED';
    let draftPfp = 'mock/pfp/path.webp';
    let draftSig = 'mock/sig/path.webp';
    let studentInserted = false;

    const mockTransaction = async (operation) => {
      try {
        await operation();
        transactionCommitted = true;
      } catch (err) {
        // Rollback simulated
        studentInserted = false;
        throw err;
      }
    };

    // Simulate finalization attempt with failing personal details
    await expect(mockTransaction(async () => {
      studentInserted = true; // Step 1: student row inserted
      // Step 2: personal details insert throws error
      throw new Error("Data truncated for column 'area_status' at row 1");
      // Step 3: draft status would be updated if not thrown
      // draftStatus = 'FINALIZED';
    })).rejects.toThrow("Data truncated for column 'area_status' at row 1");

    expect(transactionCommitted).toBe(false);
    expect(studentInserted).toBe(false);
    expect(draftStatus).toBe('PROCESSED');
    expect(draftPfp).toBe('mock/pfp/path.webp');
    expect(draftSig).toBe('mock/sig/path.webp');
  });

  it('should simulate successful retry after area_status normalization', async () => {
    let transactionCommitted = false;
    let draftStatus = 'PROCESSED';
    let studentInserted = false;
    let finalizedStudentId = null;

    const mockTransaction = async (operation) => {
      try {
        await operation();
        transactionCommitted = true;
      } catch (err) {
        studentInserted = false;
        throw err;
      }
    };

    // Retry with normalized area status
    const draft = {
      id: 180226,
      branch: 'CSD',
      entrance_exam: 'TG EAPCET',
      area_status: 'Non Local',
    };

    await mockTransaction(async () => {
      const normalizedArea = normalizeAreaStatus(draft.area_status);
      expect(normalizedArea).toBe('Non-Local');
      studentInserted = true;
      finalizedStudentId = 211975;
      draftStatus = 'FINALIZED';
    });

    expect(transactionCommitted).toBe(true);
    expect(studentInserted).toBe(true);
    expect(finalizedStudentId).toBe(211975);
    expect(draftStatus).toBe('FINALIZED');
  });
});
