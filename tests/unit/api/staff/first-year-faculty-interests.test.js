import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/staff/hod/faculty-interests/route.js';

let mockInterests = [];
let mockAffiliations = [];
let mockAssignments = [];

// Mock Auth
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
        where: vi.fn(() => ({
          orderBy: vi.fn(() => mockInterests),
          limit: vi.fn(() => [{ id: 1, current_academic_year: '2024-25' }])
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => mockAssignments)
        }))
      }))
    })),
    transaction: vi.fn(async (cb) => {
      const tx = {
        query: {
          facultySubjectInterests: {
            findFirst: vi.fn(async () => {
              return mockInterests[0] || null;
            })
          },
          facultySubjectAssignments: {
            findFirst: vi.fn(async () => null)
          }
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => mockAffiliations)
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

describe('Faculty Subject Interests — First Year Coordinator Scoping & Self-Review', () => {
  beforeEach(() => {
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
    mockAffiliations = [{ dept_code: 'ECE' }];
    mockAssignments = [];
  });

  describe('Authorization & Self-Review Protection', () => {
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

    it('rejects self-review attempt with HTTP 403', async () => {
      mockCurrentUser = {
        id: 202, // SAME as staff_account_id (self-review)
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
  });
});
