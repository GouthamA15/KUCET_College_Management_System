import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/staff/hod/faculty-interests/route.js';

let mockInterests = [];
let mockAssignments = [];
let mockIsLocked = false;
let mockWorkloadSubjects = [];
let mockTimetableClashes = [];
let mockCurrentUser = null;

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async () => mockCurrentUser),
    wrapHandler: (optionsOrHandler) => {
      const opts = typeof optionsOrHandler === 'object' ? optionsOrHandler : {};
      const handler = opts.handler || optionsOrHandler;
      return async (req) => {
        const user = mockCurrentUser;
        if (!user) {
          return { status: 401, json: async () => ({ error: 'Unauthorized' }) };
        }
        let data = {};
        if (req.method === 'POST') {
          data = await req.json();
        }
        return await handler(req, { user, data });
      };
    }
  };
});

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const res = mockTimetableClashes.length > 0 ? [...mockTimetableClashes] : [...mockWorkloadSubjects];
          res.orderBy = vi.fn(() => mockInterests);
          res.limit = vi.fn(() => mockIsLocked ? [{ id: 1, archive_type: 'SEMESTER', current_academic_year: '2024-25', is_locked: true, status: 'ARCHIVED' }] : []);
          return res;
        }),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => mockAssignments)
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => [{ insertId: 1 }])
    })),
    transaction: vi.fn(async (cb) => {
      const tx = {
        query: {
          facultySubjectInterests: {
            findFirst: vi.fn(async () => mockInterests[0] || null)
          },
          facultySubjectAssignments: {
            findFirst: vi.fn(async () => null)
          }
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => []),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => [])
            }))
          }))
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => [{ affectedRows: 1 }])
          }))
        })),
        insert: vi.fn(() => ({
          values: vi.fn((vals) => {
            mockAssignments.push(vals);
            return [{ insertId: 1 }];
          })
        }))
      };
      return await cb(tx);
    })
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb())
  }
}));

vi.mock('@/lib/academic-utils', () => ({
  getCollegeAcademicYear: vi.fn(async () => '2024-25'),
  getCurrentCalendarSession: vi.fn(async () => ({ academicYear: '2024-25', semester: 1 }))
}));

describe('Faculty Subject Interests — First Year Coordinator & HOD Scoping & Self-Allocation', () => {
  beforeEach(() => {
    mockIsLocked = false;
    mockWorkloadSubjects = [];
    mockTimetableClashes = [];
    mockInterests = [
      {
        id: 1,
        staff_account_id: 202,
        subject_code: 'MA101',
        subject_name: 'Engineering Mathematics-I',
        branch: 'ECE',
        semester: 1,
        academic_year: '2024-25',
        status: 'PENDING',
        created_at: new Date()
      }
    ];
    mockAssignments = [];
  });

  describe('Authorization & Self-Allocation Protection', () => {
    it('coordinator can approve Semester 1 request across any branch (e.g. ECE)', async () => {
      mockCurrentUser = {
        id: 101, // different from staff_account_id (202)
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('approved successfully');
      expect(mockAssignments.length).toBe(1);
      expect(mockAssignments[0].subject_code).toBe('MA101');
    });

    it('coordinator can self-approve (self-allocate) own Semester 1 request with HTTP 200', async () => {
      mockCurrentUser = {
        id: 202, // SAME as staff_account_id (self-allocation)
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'ECE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('self-allocated and assigned successfully');
      expect(mockAssignments.length).toBe(1);
      expect(mockAssignments[0].staff_account_id).toBe(202);
    });

    it('rejects regular faculty self-review attempt with HTTP 403', async () => {
      mockCurrentUser = {
        id: 202, // SAME as staff_account_id
        role: 'faculty',
        is_first_year_coordinator: false, // NOT coordinator
        is_hod: false,                    // NOT HOD
        branch: 'ECE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('cannot review your own request');
    });

    it('coordinator cannot review Semester 3-8 requests (rejected with HTTP 403)', async () => {
      mockInterests = [
        {
          id: 2,
          staff_account_id: 202,
          subject_code: 'EC301',
          subject_name: 'Signals & Systems',
          branch: 'ECE',
          semester: 3, // SEMESTER 3! Out of coordinator scope!
          academic_year: '2024-25',
          status: 'PENDING',
          created_at: new Date()
        }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 2,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('Not authorized');
    });

    it('HOD can self-approve departmental subject request with HTTP 200', async () => {
      mockInterests = [
        {
          id: 3,
          staff_account_id: 303,
          subject_code: 'CS501',
          subject_name: 'Database Management Systems',
          branch: 'CSE',
          semester: 5,
          academic_year: '2024-25',
          status: 'PENDING',
          created_at: new Date()
        }
      ];

      mockCurrentUser = {
        id: 303, // HOD self-allocation
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 3,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('self-allocated and assigned successfully');
      expect(mockAssignments.length).toBe(1);
      expect(mockAssignments[0].staff_account_id).toBe(303);
    });

    it('rejects approval when academic year is locked with HTTP 403', async () => {
      mockIsLocked = true; // Simulating locked/archived academic year

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('permanently archived');
    });

    it('allows faculty member with 4 active subject assignments to receive another valid assignment without override', async () => {
      mockWorkloadSubjects = [
        { id: 1, subject_code: 'CS101', course_semester: 1 },
        { id: 2, subject_code: 'CS102', course_semester: 1 },
        { id: 3, subject_code: 'CS103', course_semester: 1 },
        { id: 4, subject_code: 'CS104', course_semester: 1 }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('approved successfully');
      expect(mockAssignments.length).toBe(1);
    });

    it('allows faculty member with 5 active subject assignments to receive another assignment without override', async () => {
      mockWorkloadSubjects = [
        { id: 1, subject_code: 'CS101', course_semester: 1 },
        { id: 2, subject_code: 'CS102', course_semester: 1 },
        { id: 3, subject_code: 'CS103', course_semester: 1 },
        { id: 4, subject_code: 'CS104', course_semester: 1 },
        { id: 5, subject_code: 'CS105', course_semester: 1 }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('approved successfully');
      expect(mockAssignments.length).toBe(1);
    });

    it('allows faculty member with substantially more than 5 assignments (e.g. 10) to receive valid assignments', async () => {
      mockWorkloadSubjects = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        subject_code: `CS10${i + 1}`,
        course_semester: 1
      }));

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('approved successfully');
      expect(mockAssignments.length).toBe(1);
    });

    it('rejects with HTTP 409 when genuine timetable collision is detected without override', async () => {
      mockTimetableClashes = [
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'CSE', clash_semester: 1 },
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'ECE', clash_semester: 1 }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toContain('Allocation conflict detected');
      expect(json.canOverride).toBe(true);
      expect(json.conflicts[0].type).toBe('TIMETABLE_PERIOD_CLASH');
    });

    it('succeeds with HTTP 200 when genuine timetable collision is overridden with valid reason (>= 5 chars)', async () => {
      mockTimetableClashes = [
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'CSE', clash_semester: 1 },
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'ECE', clash_semester: 1 }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: true,
          override_reason: 'Timetable adjustment authorized by coordinator'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('approved successfully');
    });

    it('rejects conflict override with HTTP 403 when reason is too short', async () => {
      mockTimetableClashes = [
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'CSE', clash_semester: 1 },
        { day_of_week: 'MONDAY', period_number: 1, clash_branch: 'ECE', clash_semester: 1 }
      ];

      mockCurrentUser = {
        id: 101,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 1,
          status: 'APPROVED',
          override_conflict: true,
          override_reason: 'ok' // Less than 5 chars!
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('at least 5 characters');
    });
  });
});
