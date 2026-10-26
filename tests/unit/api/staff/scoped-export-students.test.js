import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentService } from '@/services/StudentService';

// Mocks for Next.js and System Libraries
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => new Headers()),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
}));

const mockStudents = [
  {
    roll_no: '26567T0901',
    admission_no: 'ADM-2026-001',
    name: 'Student One',
    gender: 'MALE',
    dob: '2008-05-10',
    date_of_birth: '2008-05-10',
    email: 's1@kucet.ac.in',
    mobile: '9876543210',
    father_name: 'Father One',
    mother_name: 'Mother One',
    annual_income: '150000',
    aadhaar_no: '123456789012',
    apaar_id: '123456789012',
    guardian_mobile: '9876543211',
    permanent_address: '1-23, Warangal',
    category: 'BC-A',
    sub_caste: 'Munnuru Kapu',
    seat_allotted_category: 'BC_A_GEN',
    blood_group: 'O+',
    fee_reimbursement: 'YES',
    qualifying_exam: 'TG EAPCET',
    ssc_marks: '550',
    inter_marks: '920',
    entrance_exam_rank: 4500,
  },
  {
    roll_no: '26567T0902',
    admission_no: 'ADM-2026-002',
    name: 'Student Two',
    gender: 'FEMALE',
    dob: '2008-07-15',
    date_of_birth: '2008-07-15',
    email: 's2@kucet.ac.in',
    mobile: '9876543212',
    father_name: 'Father Two',
    mother_name: 'Mother Two',
    annual_income: '250000',
    aadhaar_no: '987654321098',
    apaar_id: null, // Missing APAAR
    guardian_mobile: '9876543213',
    permanent_address: '4-56, Hanamkonda',
    category: 'OC',
    sub_caste: 'Reddy',
    seat_allotted_category: 'OC_GEN',
    blood_group: 'B+',
    fee_reimbursement: 'NO',
    qualifying_exam: 'TG EAPCET',
    ssc_marks: '580',
    inter_marks: '960',
    entrance_exam_rank: 1200,
  }
];

vi.mock('@/services/StudentService', () => ({
  StudentService: {
    getFullStudentDataForExport: vi.fn().mockImplementation(async () => mockStudents),
  },
}));

describe('P1: Scoped APAAR & Student Data Export Authorization Suite', () => {
  let exportRoute;
  let mockAuthUser;

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.doMock('@/lib/api-utils', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        getAuthUser: vi.fn(() => mockAuthUser),
      };
    });

    const routeModule = await import('@/app/api/staff/admission/export-students/route.js');
    exportRoute = routeModule.GET;
  });

  const createRequest = (params = {}) => {
    const search = new URLSearchParams({
      branch: '09',
      year: '1',
      format: 'json',
      ...params
    });
    return new Request(`http://localhost:3000/api/staff/admission/export-students?${search.toString()}`);
  };

  // 1. Admission Staff Master Export
  it('ALLOWS Admission Staff to perform previously authorized master export', async () => {
    mockAuthUser = { id: 101, role: 'admission', email: 'admission@kucet.ac.in' };
    const res = await exportRoute(createRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.students).toHaveLength(2);
    expect(json.scope).toBe('master');
    expect(json.students[0].apaar_id).toBe('123456789012');
  });

  // 2. Admin / Super Admin Access
  it('ALLOWS Super Admin to export across any scope', async () => {
    mockAuthUser = { id: 1, role: 'admin', email: 'admin@kucet.ac.in' };
    
    // Master scope
    const resMaster = await exportRoute(createRequest({ scope: 'master' }));
    expect(resMaster.status).toBe(200);

    // Scholarship scope
    const resSchol = await exportRoute(createRequest({ scope: 'scholarship' }));
    expect(resSchol.status).toBe(200);

    // Department scope
    const resDept = await exportRoute(createRequest({ scope: 'department', branch: '15' }));
    expect(resDept.status).toBe(200);

    // First Year scope
    const resFy = await exportRoute(createRequest({ scope: 'first_year' }));
    expect(resFy.status).toBe(200);
  });

  // 3. Scholarship Staff Scoped Export
  it('ALLOWS Scholarship Staff to export scholarship scope with APAAR ID and excludes sensitive PII', async () => {
    mockAuthUser = { id: 102, role: 'scholarship', email: 'scholarship@kucet.ac.in' };
    const res = await exportRoute(createRequest({ scope: 'scholarship' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scope).toBe('scholarship');
    expect(json.students).toHaveLength(2);

    const s1 = json.students[0];
    // Required scholarship & identification fields
    expect(s1.roll_no).toBe('26567T0901');
    expect(s1.admission_no).toBe('ADM-2026-001');
    expect(s1.name).toBe('Student One');
    expect(s1.category).toBe('BC-A');
    expect(s1.sub_caste).toBe('Munnuru Kapu');
    expect(s1.fee_reimbursement).toBe('YES');
    expect(s1.apaar_id).toBe('123456789012');

    // SENSITIVE PII STRICTLY EXCLUDED
    expect(s1.aadhaar_no).toBeUndefined();
    expect(s1.annual_income).toBeUndefined();
    expect(s1.father_name).toBeUndefined();
    expect(s1.mother_name).toBeUndefined();
    expect(s1.guardian_mobile).toBeUndefined();
    expect(s1.permanent_address).toBeUndefined();
    expect(s1.photo).toBeUndefined();
    expect(s1.signature).toBeUndefined();
  });

  // 4. HOD Branch Authorization & Isolation
  it('ALLOWS HOD to download students within their authorized branch', async () => {
    mockAuthUser = { 
      id: 103, 
      role: 'faculty', 
      is_hod: true, 
      branch: 'CSE', 
      authorized_branches: ['CSE'], 
      email: 'hod.cse@kucet.ac.in' 
    };
    // 09 is CSE
    const res = await exportRoute(createRequest({ scope: 'department', branch: '09' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scope).toBe('department');
    expect(json.students[0].apaar_id).toBe('123456789012');
    expect(json.students[0].aadhaar_no).toBeUndefined();
    expect(json.students[0].annual_income).toBeUndefined();
  });

  // 5. First-Year Coordinator Cohort Authorization
  it('ALLOWS First-Year Coordinator to download the first-year cohort', async () => {
    mockAuthUser = { 
      id: 104, 
      role: 'faculty', 
      is_first_year_coordinator: true, 
      email: 'coordinator@kucet.ac.in' 
    };
    const res = await exportRoute(createRequest({ scope: 'first_year', year: '1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scope).toBe('first_year');
    expect(json.students[0].apaar_id).toBe('123456789012');
    expect(json.students[0].aadhaar_no).toBeUndefined();
    expect(json.students[0].annual_income).toBeUndefined();
  });

  // 6. HOD Cross-Branch Tampering Defense
  it('DENIES HOD (403) from exporting another branch outside their assignment', async () => {
    mockAuthUser = { 
      id: 103, 
      role: 'faculty', 
      is_hod: true, 
      branch: 'CSE', 
      authorized_branches: ['CSE'], 
      email: 'hod.cse@kucet.ac.in' 
    };
    // Attempting to export ECE (15)
    const res = await exportRoute(createRequest({ scope: 'department', branch: '15' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden: You do not have permission to export students for branch/i);
  });

  // 7. Coordinator Cross-Cohort Broadening Defense
  it('DENIES First-Year Coordinator (403) from requesting senior cohorts (Year 2, 3, 4)', async () => {
    mockAuthUser = { 
      id: 104, 
      role: 'faculty', 
      is_first_year_coordinator: true, 
      email: 'coordinator@kucet.ac.in' 
    };
    const res = await exportRoute(createRequest({ scope: 'first_year', year: '2' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden: First-Year Coordinators can only export the first-year cohort/i);
  });

  // 8. Unauthorized Roles Denied
  it('DENIES unauthorized roles from exporting scoped datasets', async () => {
    // Standard faculty trying to access scholarship export
    mockAuthUser = { id: 105, role: 'faculty', email: 'faculty@kucet.ac.in' };
    const resSchol = await exportRoute(createRequest({ scope: 'scholarship' }));
    expect(resSchol.status).toBe(403);

    // Standard faculty trying to access HOD export
    const resDept = await exportRoute(createRequest({ scope: 'department' }));
    expect(resDept.status).toBe(403);

    // Standard faculty trying to access Coordinator export
    const resFy = await exportRoute(createRequest({ scope: 'first_year' }));
    expect(resFy.status).toBe(403);

    // Scholarship clerk trying to access HOD export
    mockAuthUser = { id: 102, role: 'scholarship', email: 'scholarship@kucet.ac.in' };
    const resScholDept = await exportRoute(createRequest({ scope: 'department' }));
    expect(resScholDept.status).toBe(403);
  });

  // 9. Fail-Closed on Missing/Invalid Assignments
  it('FAILS CLOSED (403) when HOD has empty authorized branches', async () => {
    mockAuthUser = { id: 106, role: 'faculty', is_hod: true, branch: null, authorized_branches: [] };
    const res = await exportRoute(createRequest({ scope: 'department', branch: '09' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden/i);
  });

  // 10. Direct API Unauthenticated Requests Denied (401)
  it('DENIES unauthenticated direct API requests with 401', async () => {
    mockAuthUser = null;
    const res = await exportRoute(createRequest({ scope: 'scholarship' }));
    expect(res.status).toBe(401);
  });

  // 11. Consistent Representation of Missing APAAR IDs
  it('represents missing APAAR ID consistently as "Not Submitted"', async () => {
    mockAuthUser = { id: 102, role: 'scholarship', email: 'scholarship@kucet.ac.in' };
    const res = await exportRoute(createRequest({ scope: 'scholarship' }));
    const json = await res.json();
    expect(json.students[1].apaar_id).toBe('Not Submitted');
  });

  // 12. Formula Injection Sanitization
  it('sanitizes formula-leading values (=, +, -, @) to prevent CSV/Excel injection', async () => {
    mockAuthUser = { id: 102, role: 'scholarship', email: 'scholarship@kucet.ac.in' };
    const maliciousStudents = [
      {
        roll_no: '=cmd|"/C calc"!A0',
        name: '+SUM(1,2)',
        admission_no: '-DANGEROUS',
        email: '@attacker.com',
        apaar_id: '123456789012'
      }
    ];
    vi.mocked(StudentService.getFullStudentDataForExport).mockResolvedValueOnce(maliciousStudents);

    const res = await exportRoute(createRequest({ scope: 'scholarship' }));
    const json = await res.json();
    const student = json.students[0];

    expect(student.roll_no).toBe('\'=cmd|"/C calc"!A0');
    expect(student.name).toBe('\'+SUM(1,2)');
    expect(student.admission_no).toBe('\'-DANGEROUS');
    expect(student.email).toBe('\'@attacker.com');
  });

  // 13. Invalid Scope Handling
  it('returns 400 for completely invalid export scope', async () => {
    mockAuthUser = { id: 1, role: 'admin', email: 'admin@kucet.ac.in' };
    const res = await exportRoute(createRequest({ scope: 'malicious_scope' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid export scope');
  });
});
