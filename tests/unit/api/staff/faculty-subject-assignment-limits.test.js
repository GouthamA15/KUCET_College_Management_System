import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAllocationConflicts, canOverrideAllocationConflict } from '@/lib/academic-authorization.js';
import { POST as handleInterestPost } from '@/app/api/staff/hod/faculty-interests/route.js';
import { POST as handleAssignmentPost } from '@/app/api/staff/hod/subject-assignments/route.js';

let mockCurrentUser = null;
let mockActiveAssignments = [];
let mockTimetableSlots = [];
let mockCoTeachingAllocations = [];
let mockInterests = [];
let mockStaffRoles = [{ id: 50, name: 'Dr. Test Faculty', role_code: 'FACULTY' }];
let mockExistingDbAssignments = [];
let mockSyllabus = [{ subject_code: 'CS505' }];
let insertedAssignments = [];
let mockIsLocked = false;

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
        if (req.method === 'POST' && req.clone) {
          try {
            data = await req.clone().json();
          } catch (_e) {
            data = {};
          }
        }
        return await handler(req, { user, data });
      };
    }
  };
});

vi.mock('@/db', () => {
  const mockDb = {
    select: vi.fn((_fields) => ({
      from: vi.fn((tbl) => {
        const tableName = tbl?.[Symbol.for('drizzle:Name')] || tbl?.name;
        return {
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => mockStaffRoles)
              }))
            })),
            where: vi.fn(() => mockCoTeachingAllocations)
          })),
          where: vi.fn(() => {
            let res = [];
            if (tableName === 'branch_timetable') {
              res = [...mockTimetableSlots];
            } else if (tableName === 'syllabus_structure') {
              res = [...mockSyllabus];
            } else if (tableName === 'college_info') {
              res = [{ id: 1, current_academic_year: '2024-25' }];
            } else if (tableName === 'academic_calendar_archives') {
              res = mockIsLocked ? [{ is_locked: true, status: 'ARCHIVED' }] : [];
            } else if (tableName === 'faculty_subject_assignments') {
              res = [...mockExistingDbAssignments];
            } else {
              res = [...mockActiveAssignments];
            }
            res.orderBy = vi.fn(() => mockInterests);
            res.limit = vi.fn(() => {
              if (tableName === 'academic_calendar_archives') {
                return mockIsLocked ? [{ is_locked: true, status: 'ARCHIVED' }] : [];
              }
              if (tableName === 'syllabus_structure') {
                return [...mockSyllabus];
              }
              if (tableName === 'college_info') {
                return [{ id: 1, current_academic_year: '2024-25' }];
              }
              if (tableName === 'faculty_subject_assignments') {
                return [...mockExistingDbAssignments];
              }
              if (tableName === 'staff_accounts') {
                return [...mockStaffRoles];
              }
              return [...res];
            });
            return res;
          })
        };
      })
    })),
    insert: vi.fn(() => ({
      values: vi.fn((vals) => {
        insertedAssignments.push(vals);
        return [{ insertId: 999 }];
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => [{ affectedRows: 1 }])
      }))
    })),
    query: {
      facultySubjectInterests: {
        findFirst: vi.fn(async () => mockInterests[0] || null)
      },
      facultySubjectAssignments: {
        findFirst: vi.fn(async () => mockExistingDbAssignments[0] || null)
      }
    }
  };
  mockDb.transaction = vi.fn(async (cb) => cb(mockDb));
  return { db: mockDb };
});

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

describe('Faculty Subject Assignment Limits & Conflict Validation Removal', () => {
  beforeEach(() => {
    mockCurrentUser = null;
    mockActiveAssignments = [];
    mockTimetableSlots = [];
    mockCoTeachingAllocations = [];
    mockExistingDbAssignments = [];
    insertedAssignments = [];
    mockInterests = [
      {
        id: 10,
        staff_account_id: 50,
        subject_code: 'CS502',
        subject_name: 'Operating Systems',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25',
        status: 'PENDING',
        created_at: new Date()
      }
    ];
  });

  describe('Core Business Rule: No Fixed Maximum Number of Subjects (checkAllocationConflicts)', () => {
    it('does not flag a conflict or threshold warning when faculty member has 4 active assignments', async () => {
      const result = await checkAllocationConflicts({
        faculty_id: 50,
        subject_code: 'CS502',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25'
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      // Must not contain any 4-subject threshold warning
      expect(JSON.stringify(result)).not.toContain('threshold is 4');
      expect(JSON.stringify(result)).not.toContain('WORKLOAD_EXCEEDED');
    });

    it('does not flag a conflict or threshold warning when faculty member has 5 active assignments', async () => {
      const result = await checkAllocationConflicts({
        faculty_id: 50,
        subject_code: 'CS503',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25'
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('threshold is 4');
      expect(JSON.stringify(result)).not.toContain('Standard threshold');
    });

    it('does not flag a conflict when faculty member has substantially more than 5 assignments (e.g. 12 assignments)', async () => {
      const result = await checkAllocationConflicts({
        faculty_id: 50,
        subject_code: 'CS504',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25'
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('WORKLOAD_EXCEEDED');
    });
  });

  describe('Legitimate Safeguards Preservation', () => {
    it('preserves genuine timetable collision conflicts independently of subject count', async () => {
      mockTimetableSlots = [
        { day_of_week: 'TUESDAY', period_number: 3, clash_branch: 'CSE', clash_semester: 5 },
        { day_of_week: 'TUESDAY', period_number: 3, clash_branch: 'CSE', clash_semester: 3 }
      ];

      const result = await checkAllocationConflicts({
        faculty_id: 50,
        subject_code: 'CS502',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25'
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].type).toBe('TIMETABLE_PERIOD_CLASH');
      expect(result.conflicts[0].message).toContain('Timetable collision on TUESDAY Period 3');
    });

    it('preserves co-teaching informational warnings without converting them into blocking conflicts', async () => {
      mockCoTeachingAllocations = [
        { id: 101, faculty_name: 'Prof. Existing Instructor', staff_account_id: 99 }
      ];

      const result = await checkAllocationConflicts({
        faculty_id: 50,
        subject_code: 'CS502',
        branch: 'CSE',
        semester: 5,
        academic_year: '2024-25'
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('already assigned to Prof. Existing Instructor');
      expect(result.warnings[0]).toContain('co-teaching allocation');
    });

    it('enforces override reason validation (>= 5 chars) for genuine timetable conflicts', () => {
      const user = { role: 'hod', branch: 'CSE', is_hod: true, hod_branches: ['CSE'] };

      const tooShort = canOverrideAllocationConflict(user, {
        branch: 'CSE',
        semester: 5,
        reason: 'ok'
      });
      expect(tooShort.allowed).toBe(false);
      expect(tooShort.reason).toContain('at least 5 characters');

      const valid = canOverrideAllocationConflict(user, {
        branch: 'CSE',
        semester: 5,
        reason: 'Timetable clash resolved via lab section swap'
      });
      expect(valid.allowed).toBe(true);
    });
  });

  describe('API Workflow: Subject-Interest Approval (POST /api/staff/hod/faculty-interests)', () => {
    it('approves subject interest for faculty with 4 active assignments without 409 conflict or override reason', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 10,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await handleInterestPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('Interest approved successfully');
      expect(json.hasConflict).toBeUndefined();
    });

    it('approves subject interest for faculty with 5 active assignments without 409 conflict or override reason', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 10,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await handleInterestPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('Interest approved successfully');
    });

    it('approves subject interest for faculty with substantially more than 5 assignments (e.g. 15)', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 10,
          status: 'APPROVED',
          override_conflict: false
        })
      });

      const res = await handleInterestPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('Interest approved successfully');
    });

    it('blocks approval if actor is not authorized for branch/department', async () => {
      mockCurrentUser = {
        id: 2,
        role: 'hod',
        is_hod: true,
        hod_branches: ['ECE'], // ECE HOD cannot review CSE Sem 5
        branch: 'ECE'
      };

      const req = new Request('http://localhost/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: 10,
          status: 'APPROVED'
        })
      });

      const res = await handleInterestPost(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('Not authorized');
    });
  });

  describe('API Workflow: Direct Subject Assignment (POST /api/staff/hod/subject-assignments)', () => {
    it('creates assignment for faculty regardless of active subject count without requiring override', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      const req = new Request('http://localhost/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_faculty_id: 50,
          subject_code: 'CS505',
          subject_name: 'Advanced Algorithms',
          branch: 'CSE',
          semester: 5,
          academic_year: '2024-25',
          override_conflict: false
        })
      });

      const res = await handleAssignmentPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('successfully');
      expect(insertedAssignments.length).toBeGreaterThan(0);
    });

    it('enforces genuine duplicate assignment handling idempotently', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CSE'],
        branch: 'CSE'
      };

      // Existing assignment is already present
      mockExistingDbAssignments = [{ id: 450, is_active: true }];

      const req = new Request('http://localhost/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_faculty_id: 50,
          subject_code: 'CS505',
          subject_name: 'Advanced Algorithms',
          branch: 'CSE',
          semester: 5,
          academic_year: '2024-25',
          override_conflict: false
        })
      });

      const res = await handleAssignmentPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.assignment_id).toBe(450);
    });

    it('enforces role and branch authorization boundaries', async () => {
      mockCurrentUser = {
        id: 2,
        role: 'hod',
        is_hod: true,
        hod_branches: ['CIVIL'], // CIVIL HOD cannot assign CSE subjects
        branch: 'CIVIL'
      };

      const req = new Request('http://localhost/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_faculty_id: 50,
          subject_code: 'CS505',
          subject_name: 'Advanced Algorithms',
          branch: 'CSE',
          semester: 5,
          academic_year: '2024-25'
        })
      });

      const res = await handleAssignmentPost(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toMatch(/Unauthorized|You do not have HOD authority/);
    });
  });
});
