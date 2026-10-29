import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { GET as getCoverage } from '@/app/api/staff/hod/academic-coverage/route';
import { POST as postAssignment } from '@/app/api/staff/hod/subject-assignments/route';

let mockCurrentUser = null;
let mockSyllabus = [];
let mockAssignments = [];
let mockInterests = [];
let mockSlots = [];
let mockAuditLogs = [];
let mockFaculty = [];

vi.mock('@/lib/academic-authorization', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    assertAcademicYearNotLocked: vi.fn(async () => {}),
    isAcademicYearLocked: vi.fn(async () => ({ isLocked: false }))
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn())
  }
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async () => mockCurrentUser),
    wrapHandler: (optionsOrHandler) => {
      const opts = typeof optionsOrHandler === 'object' ? optionsOrHandler : {};
      const handler = opts.handler || optionsOrHandler;
      return async (req, context = {}) => {
        const user = mockCurrentUser;
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        const result = await handler(req, { user, context });
        if (result instanceof Response) return result;
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
    }
  };
});

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        let tableName = '';
        try {
          tableName = getTableName(table);
        } catch (_e) {
          tableName = table?._?.name || '';
        }
        
        const executeQuery = () => {
          if (tableName === 'college_info') {
            return [{ id: 1, current_academic_year: '2026-27' }];
          }
          if (tableName === 'semesters') {
            return [{ id: 180017, academic_year: '2026-27', semester: 1, start_date: '2026-08-09', end_date: '2027-02-10' }];
          }
          if (tableName === 'syllabus_structure') {
            return mockSyllabus.map(s => ({
              subject_code: s.subject_code,
              subject_name: s.subject_name,
              subject_type: s.subject_type || 'theory',
              is_group: false,
              parent_group_code: null
            }));
          }
          if (tableName === 'faculty_subject_assignments') {
            return mockAssignments;
          }
          if (tableName === 'faculty_subject_interests') {
            return mockInterests;
          }
          if (tableName === 'branch_timetable') {
            return mockSlots;
          }
          if (tableName === 'staff_accounts') {
            return mockFaculty;
          }
          if (tableName === 'staff_account_roles' || tableName === 'staff_roles') {
            return [{ id: 1, role_code: 'FACULTY', staff_account_id: 180009 }];
          }
          return [];
        };

        const chain = {
          innerJoin: vi.fn(() => chain),
          leftJoin: vi.fn(() => chain),
          where: vi.fn(() => {
            const list = executeQuery();
            list.orderBy = vi.fn(() => list);
            list.groupBy = vi.fn(() => list);
            list.limit = vi.fn((n) => list.slice(0, n || 1));
            return list;
          }),
          orderBy: vi.fn(() => {
            const list = executeQuery();
            list.limit = vi.fn((n) => list.slice(0, n || 1));
            return list;
          }),
          groupBy: vi.fn(() => executeQuery()),
          limit: vi.fn((n) => executeQuery().slice(0, n || 1))
        };
        return chain;
      })
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (val) => {
        mockAuditLogs.push(val);
        const insertId = 990001 + mockAssignments.length;
        if (val.subject_code) {
          mockAssignments.push({ id: insertId, ...val });
        }
        return [{ insertId }];
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => [{ affectedRows: 1 }])
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => [{ affectedRows: 1 }])
    }))
  }
}));

describe('First Year Coordinator Academic Coverage & Assignment Intelligence', () => {
  beforeEach(() => {
    mockCurrentUser = {
      id: 180009,
      email: 'kalpanadevimora@gmail.com',
      name: 'Dr.M.Kalpana Devi',
      role: 'faculty',
      is_first_year_coordinator: true,
      coordinator_type: 'FIRST_YEAR',
      coordinator_assignment: {
        id: 1,
        academic_year: '2026-27',
        start_date: '2026-10-23'
      },
      academic_year: '2026-27'
    };

    mockFaculty = [
      { id: 180009, name: 'Dr.M.Kalpana Devi', employee_id: 'KU-BAD807-0808', account_status: 'ACTIVE', role_code: 'FACULTY' },
      { id: 180005, name: 'Goutham', employee_id: 'KU-0CFA68-4927', account_status: 'ACTIVE', role_code: 'FACULTY' }
    ];

    mockSyllabus = [
      { subject_code: 'BSC101', subject_name: 'Physics', subject_type: 'theory' },
      { subject_code: 'BSC101L', subject_name: 'Physics-Practical', subject_type: 'lab' },
      { subject_code: 'BSC103', subject_name: 'Mathematics-I', subject_type: 'theory' },
      { subject_code: 'ESC101', subject_name: 'Basic Electrical Engineering', subject_type: 'theory' },
      { subject_code: 'ESC101L', subject_name: 'Basic Electrical Engineering Lab', subject_type: 'lab' },
      { subject_code: 'ESC102', subject_name: 'Engineering Graphics & Design', subject_type: 'theory' },
      { subject_code: 'ESC104', subject_name: 'Engineering Mechanics', subject_type: 'theory' }
    ];

    mockAssignments = [];
    mockInterests = [];
    mockSlots = [];
    mockAuditLogs = [];
  });

  it('correctly reports Physics and Physics-Practical as covered when 2026-27 assignments exist', async () => {
    // Setup active assignments for Physics and Physics-Practical in 2026-27
    mockAssignments = [
      {
        id: 270017,
        faculty_id: 180009,
        faculty_name: 'Dr.M.Kalpana Devi',
        employee_id: 'KU-BAD807-0808',
        faculty_email: 'kalpanadevimora@gmail.com',
        faculty_designation: 'Assistant Professor (C)',
        subject_code: 'BSC101',
        subject_name: 'Physics',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_active: true
      },
      {
        id: 270018,
        faculty_id: 180009,
        faculty_name: 'Dr.M.Kalpana Devi',
        employee_id: 'KU-BAD807-0808',
        faculty_email: 'kalpanadevimora@gmail.com',
        faculty_designation: 'Assistant Professor (C)',
        subject_code: 'BSC101L',
        subject_name: 'Physics-Practical',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_active: true
      }
    ];

    const req = new Request('http://localhost:3000/api/staff/hod/academic-coverage?branch=CSE&semester=1&academic_year=2026-27');
    const res = await getCoverage(req, { user: mockCurrentUser });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.academic_year).toBe('2026-27');
    expect(json.data.summary.total_syllabus_subjects).toBe(7);
    expect(json.data.summary.covered_subjects_count).toBe(2);
    expect(json.data.summary.unassigned_subjects_count).toBe(5);
    expect(json.data.summary.coverage_percentage).toBe(29);

    // Physics and Physics-Practical must be in covered_subjects
    const coveredCodes = json.data.covered_subjects.map(c => c.subject_code);
    expect(coveredCodes).toContain('BSC101');
    expect(coveredCodes).toContain('BSC101L');

    // Neither Physics nor Physics-Practical should appear in UNASSIGNED alerts
    const unassignedAlerts = json.data.alerts.filter(a => a.type === 'UNASSIGNED_SUBJECT');
    const unassignedCodes = unassignedAlerts.map(a => a.subject_code);
    expect(unassignedCodes).not.toContain('BSC101');
    expect(unassignedCodes).not.toContain('BSC101L');
    expect(unassignedCodes).toEqual(['BSC103', 'ESC101', 'ESC101L', 'ESC102', 'ESC104']);
  });

  it('distinguishes academic years and reports unassigned when an old year with 0 assignments is queried', async () => {
    // If 2025-26 has no assignments, coverage is 0%
    mockAssignments = [];

    const req = new Request('http://localhost:3000/api/staff/hod/academic-coverage?branch=CSE&semester=1&academic_year=2025-26');
    const res = await getCoverage(req, { user: mockCurrentUser });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.academic_year).toBe('2025-26');
    expect(json.data.summary.covered_subjects_count).toBe(0);
    expect(json.data.summary.unassigned_subjects_count).toBe(7);
    expect(json.data.summary.coverage_percentage).toBe(0);
  });

  it('allows First Year Coordinator to directly allocate a subject within Sem 1 & 2 across branches', async () => {
    const payload = {
      subject_code: 'ESC101',
      subject_name: 'Basic Electrical Engineering',
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-27',
      faculty_id: 180009 // Self-allocation
    };

    const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await postAssignment(req, { user: mockCurrentUser });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain('self-allocated');
  });

  it('prevents First Year Coordinator from allocating subjects in upper semesters (3-8)', async () => {
    const payload = {
      subject_code: 'PCC301',
      subject_name: 'Data Structures',
      branch: 'CSE',
      semester: 3,
      academic_year: '2026-27',
      faculty_id: 180009
    };

    const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await postAssignment(req, { user: mockCurrentUser });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('restricted to Semesters 1 and 2');
  });

  it('preserves existing assignments and avoids duplicate rows on re-assignment', async () => {
    mockAssignments = [
      {
        id: 270017,
        staff_account_id: 180009,
        subject_code: 'BSC101',
        subject_name: 'Physics',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_active: true
      }
    ];

    const payload = {
      subject_code: 'BSC101',
      subject_name: 'Physics',
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-27',
      faculty_id: 180009
    };

    const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await postAssignment(req, { user: mockCurrentUser });
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should be idempotent and return existing id without creating duplicate
    expect(json.assignment_id).toBe(270017);
  });
});
