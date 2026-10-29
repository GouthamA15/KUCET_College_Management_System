import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/staff/coordinator/academic-monitoring/route';
import { db } from '@/db';

let mockCurrentUser = null;

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

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  getCollegeAcademicYear: vi.fn().mockResolvedValue('2025-26'),
  deriveDefaultAcademicYear: vi.fn().mockReturnValue('2025-26'),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

function createChainMock(resolveValue = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    then: (fn) => Promise.resolve(resolveValue).then(fn),
  };
  return chain;
}

describe('First-Year Coordinator Academic Monitoring Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    db.select.mockImplementation(() => createChainMock([]));
  });

  it('rejects unauthorized faculty who are not Coordinator or Supervisor with 403', async () => {
    mockCurrentUser = {
      id: 99,
      role: 'faculty',
      branch: 'CSE',
      is_first_year_coordinator: false,
      is_principal: false
    };

    const req = new Request('http://localhost/api/staff/coordinator/academic-monitoring');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });

  it('strictly rejects Coordinator requests for Semesters 3 to 8 with 403', async () => {
    mockCurrentUser = {
      id: 30,
      role: 'faculty',
      branch: 'ECE',
      is_first_year_coordinator: true
    };

    const req = new Request('http://localhost/api/staff/coordinator/academic-monitoring?semester=4');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('strictly restricted to Semesters 1 and 2');
  });

  it('allows Coordinator to monitor all 7 institutional branches for Semesters 1 & 2', async () => {
    mockCurrentUser = {
      id: 30,
      role: 'faculty',
      branch: 'ECE',
      is_first_year_coordinator: true
    };

    // 1. Assignments query
    const mockAssignments = [
      {
        id: 101,
        subject_code: 'MA101',
        subject_name: 'Engineering Mathematics I',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2025-26',
        staff_account_id: 11,
        faculty_name: 'Dr. Rao',
        faculty_email: 'rao@kucet.ac.in',
        is_active: true
      },
      {
        id: 102,
        subject_code: 'PH101',
        subject_name: 'Engineering Physics',
        branch: 'MECH',
        course_semester: 1,
        academic_year: '2025-26',
        staff_account_id: 12,
        faculty_name: 'Dr. Smith',
        faculty_email: 'smith@kucet.ac.in',
        is_active: true
      }
    ];

    // 2. Timetable slots query
    const mockTimetable = [
      { subject_code: 'MA101', branch: 'CSE', semester: 1, academic_year: '2025-26', faculty_id: 11, count: 4 }
    ];

    // 3. Attendance sessions count query
    const mockSessions = [
      { assignment_id: 101, session_count: 12, last_session_date: '2026-09-10' },
      { assignment_id: 102, session_count: 0, last_session_date: null }
    ];

    // 4. Marks status query
    const mockMarks = [
      { assignment_id: 101, total_entered: 60, published_count: 60, draft_count: 0 }
    ];

    // 5. Condonation risk query
    const mockRisk = [
      { roll_no: '26567T0901', name: 'Student A', branch: 'CSE', total_present: 5, total_sessions: 12, percentage: 41.7 }
    ];

    db.select
      .mockReturnValueOnce(createChainMock(mockAssignments))
      .mockReturnValueOnce(createChainMock(mockTimetable))
      .mockReturnValueOnce(createChainMock(mockSessions))
      .mockReturnValueOnce(createChainMock(mockMarks))
      .mockReturnValueOnce(createChainMock(mockRisk));

    const req = new Request('http://localhost/api/staff/coordinator/academic-monitoring?branch=all&semester=1');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(data.summary.total_subjects).toBe(2);
    expect(data.summary.total_conducted_sessions).toBe(12);
    expect(data.summary.no_sessions_subjects).toBe(1); // PH101 has 0 sessions
    expect(data.summary.compliant_subjects).toBe(1);   // MA101 is on track
    expect(data.records.length).toBe(2);
    expect(data.records[0].compliance_status).toBe('ON_TRACK');
    expect(data.records[1].compliance_status).toBe('NO_SESSIONS');
    expect(data.records[0].marks_status).toBe('PUBLISHED');
    expect(data.records[1].marks_status).toBe('PENDING');
    expect(data.at_risk_students.length).toBe(1);
    expect(data.at_risk_students[0].percentage).toBeLessThan(75);
  });
});
