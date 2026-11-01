import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/staff/coordinator/apaar-monitoring/route';
import { FirstYearApaarService, sanitizeSpreadsheetValue, formatApaarDisplay } from '@/services/academic/FirstYearApaarService';
import { db } from '@/db';
import ExcelJS from 'exceljs';

// --- Mocks ---
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => new Headers()),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  getCurrentCalendarSession: vi.fn().mockResolvedValue({
    academicYear: '2026-27',
    semester: 1,
  }),
  calculateStudentYearAndSemester: vi.fn((rollNo) => {
    // If roll number starts with '26', it's First Year
    if (String(rollNo).startsWith('26')) {
      return { yearOfStudy: 1, semester: 1 };
    }
    // '25' is Year 2
    if (String(rollNo).startsWith('25')) {
      return { yearOfStudy: 2, semester: 3 };
    }
    return { yearOfStudy: 3, semester: 5 };
  }),
}));

const mockAuthUserHelper = vi.fn();
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: (...args) => mockAuthUserHelper(...args),
  };
});

describe('P1: First-Year Coordinator APAAR ID Monitoring & Scoped Exports Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const coordinatorUser = {
    id: 501,
    role: 'faculty',
    is_first_year_coordinator: true,
    email: 'coordinator@kucet.ac.in',
    name: 'Dr. Coordinator',
  };

  const adminUser = {
    id: 1,
    role: 'admin',
    email: 'admin@kucet.ac.in',
    name: 'Super Administrator',
  };

  const regularFacultyUser = {
    id: 601,
    role: 'faculty',
    is_first_year_coordinator: false,
    email: 'faculty@kucet.ac.in',
    name: 'Prof. Regular',
  };

  const studentUser = {
    id: 701,
    role: 'student',
    roll_no: '26567T0901',
  };

  const sampleStudents = [
    {
      id: 1,
      roll_no: '26567T0901', // CSE Year 1
      admission_no: 'ADM-2026-001',
      name: 'Adepu Sucharitha',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      apaar_id: '123456789012', // Submitted
    },
    {
      id: 2,
      roll_no: '26567T0902', // CSE Year 1
      admission_no: 'ADM-2026-002',
      name: 'Bandi Rahul',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      apaar_id: null, // Pending
    },
    {
      id: 3,
      roll_no: '26567T1501', // ECE Year 1
      admission_no: 'ADM-2026-015',
      name: 'Challa Deepika',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      apaar_id: '987654321098', // Submitted
    },
    {
      id: 4,
      roll_no: '26567T1502', // ECE Year 1
      admission_no: 'ADM-2026-016',
      name: 'Durgam Vinay',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      apaar_id: null, // Pending
    },
    {
      id: 5,
      roll_no: '25567T0901', // CSE Year 2 (Senior cohort - MUST BE EXCLUDED)
      admission_no: 'ADM-2025-001',
      name: 'Senior Student',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      apaar_id: '111122223333',
    },
  ];

  const sampleDrafts = [
    {
      id: 99,
      admission_year: '2026-2027',
      branch: 'MECH',
      name: 'Goud Akhil', // No roll number yet
      apaar_id: null, // Pending
      status: 'PROCESSED',
    },
  ];

  function setupDbMocks() {
    let callCount = 0;
    db.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount % 2 === 1) {
                return Promise.resolve(sampleStudents);
              }
              return Promise.resolve(sampleDrafts);
            }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(sampleDrafts)),
        }),
      }),
    }));

    db.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    });
  }

  describe('1. Authentication and Authorization Guardrails', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      mockAuthUserHelper.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('DENIES access (403) for standard Faculty who is NOT a First-Year Coordinator', async () => {
      mockAuthUserHelper.mockResolvedValue(regularFacultyUser);

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden: Access denied/i);
    });

    it('DENIES access (403) for Student role', async () => {
      mockAuthUserHelper.mockResolvedValue(studentUser);

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('ALLOWS authorized First-Year Coordinator to access monitoring data', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.isCoordinator).toBe(true);
    });

    it('ALLOWS Admin to access First-Year APAAR monitoring data', async () => {
      mockAuthUserHelper.mockResolvedValue(adminUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('2. First-Year Scoping & Cohort Summary Statistics', () => {
    it('returns only First-Year students and strictly excludes senior cohorts', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      const json = await res.json();

      // Senior student '25567T0901' must NOT be included
      const studentRolls = json.students.map((s) => s.roll_no).filter(Boolean);
      expect(studentRolls).not.toContain('25567T0901');
      expect(studentRolls).toContain('26567T0901');
      expect(studentRolls).toContain('26567T1501');
    });

    it('computes accurate global cohort summary counts (total, submitted, pending, %)', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      const json = await res.json();

      expect(json.summary).toBeDefined();
      expect(json.summary.totalStudents).toBe(5); // 4 first-year roll nos + 1 admission draft
      expect(json.summary.submittedCount).toBe(2); // 26567T0901, 26567T1501
      expect(json.summary.pendingCount).toBe(3); // 26567T0902, 26567T1502, Goud Akhil
      expect(json.summary.submissionPercentage).toBe(40); // 2/5 = 40%
    });

    it('handles students without a university roll number using admission identifier', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      const json = await res.json();

      const draftStudent = json.students.find((s) => s.name === 'Goud Akhil');
      expect(draftStudent).toBeDefined();
      expect(draftStudent.roll_no).toBeNull();
      expect(draftStudent.admission_no).toBe('ADM-DRAFT-99');
      expect(draftStudent.status).toBe('Pending');
      expect(draftStudent.apaar_id).toBeNull();
    });
  });

  describe('3. Filtering & Search', () => {
    it('filters students strictly by branch', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      // Filter by CSE
      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?branch=CSE');
      const res = await GET(req);
      const json = await res.json();

      expect(json.students.every((s) => s.branch === 'CSE')).toBe(true);
      expect(json.filteredSummary.totalStudents).toBe(2);
      expect(json.filteredSummary.submittedCount).toBe(1);
      expect(json.filteredSummary.pendingCount).toBe(1);
    });

    it('filters students by Pending status', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?status=PENDING');
      const res = await GET(req);
      const json = await res.json();

      expect(json.students.every((s) => s.status === 'Pending')).toBe(true);
      expect(json.students.every((s) => s.apaar_id === null)).toBe(true);
    });

    it('filters students by Submitted status', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?status=SUBMITTED');
      const res = await GET(req);
      const json = await res.json();

      expect(json.students.every((s) => s.status === 'Submitted')).toBe(true);
      expect(json.students.every((s) => /^\d{12}$/.test(s.apaar_id))).toBe(true);
    });

    it('supports search by student name or roll number', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      // Search by partial roll number
      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?search=T1501');
      const res = await GET(req);
      const json = await res.json();

      expect(json.students).toHaveLength(1);
      expect(json.students[0].name).toBe('Challa Deepika');
    });
  });

  describe('4. Sensitive PII Exclusion Invariant', () => {
    it('NEVER discloses Aadhaar numbers, family income, or parental PII in monitoring response', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring');
      const res = await GET(req);
      const json = await res.json();

      for (const student of json.students) {
        expect(student.aadhaar_no).toBeUndefined();
        expect(student.aadhaar_hash).toBeUndefined();
        expect(student.annual_income).toBeUndefined();
        expect(student.father_name).toBeUndefined();
        expect(student.mother_name).toBeUndefined();
        expect(student.guardian_mobile).toBeUndefined();
        expect(student.permanent_address).toBeUndefined();
      }
    });
  });

  describe('5. Excel Export Generation, Audit Trail & Formula Injection Defense', () => {
    it('streams Excel file with correct Content-Type and filename', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?format=excel&branch=CSE');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
      expect(res.headers.get('content-disposition')).toMatch(/KUCET_FirstYear_APAAR_Report_CSE_/i);

      // Verify audit logging call
      expect(db.insert).toHaveBeenCalled();
    });

    it('generates Pending-only export with appropriate report filename', async () => {
      mockAuthUserHelper.mockResolvedValue(coordinatorUser);
      setupDbMocks();

      const req = new Request('http://localhost:3000/api/staff/coordinator/apaar-monitoring?format=excel&status=PENDING&branch=ALL');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toMatch(/KUCET_FirstYear_APAAR_Pending_AllBranches_/i);
    });

    it('sanitizes formula-leading prefixes (=, +, -, @) against CSV/Excel formula injection', () => {
      expect(sanitizeSpreadsheetValue('=cmd|"/c calc"!A0')).toBe('\'=cmd|"/c calc"!A0');
      expect(sanitizeSpreadsheetValue('+SUM(A1:A10)')).toBe('\'+SUM(A1:A10)');
      expect(sanitizeSpreadsheetValue('-12345')).toBe('\'-12345');
      expect(sanitizeSpreadsheetValue('@eval()')).toBe('\'@eval()');
      expect(sanitizeSpreadsheetValue('Regular Student')).toBe('Regular Student');
      expect(sanitizeSpreadsheetValue(12345)).toBe(12345);
    });

    it('formats APAAR ID into 4-digit grouped display string', () => {
      expect(formatApaarDisplay('123456789012')).toBe('1234 5678 9012');
      expect(formatApaarDisplay('1234 5678 9012')).toBe('1234 5678 9012');
      expect(formatApaarDisplay(null)).toBe('');
      expect(formatApaarDisplay('')).toBe('');
    });

    it('ensures pending students have blank APAAR ID in Excel workbook', async () => {
      setupDbMocks();

      const { fileBuffer } = await FirstYearApaarService.generateExcelWorkbook({
        branch: 'CSE',
        status: 'ALL',
        staffUser: coordinatorUser,
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);

      const worksheet = workbook.getWorksheet(1);
      expect(worksheet).toBeDefined();

      // Check header columns
      const headers = worksheet.getRow(1).values;
      expect(headers).toContain('Student Name');
      expect(headers).toContain('Roll Number');
      expect(headers).toContain('APAAR Status');
      expect(headers).toContain('APAAR ID');

      // Check rows: pending student must have empty APAAR ID
      // Column 6 = APAAR Status, Column 7 = APAAR ID Number
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const status = row.getCell(6).value;
        const apaarId = row.getCell(7).value;

        if (status === 'Pending') {
          expect(apaarId === '' || apaarId === null || apaarId === undefined).toBe(true);
        } else if (status === 'Submitted') {
          expect(apaarId).toMatch(/\d{4} \d{4} \d{4}/);
        }
      });
    });
  });
});
