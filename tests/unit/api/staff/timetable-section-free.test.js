import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/staff/hod/timetable/route';
import { POST as postEntry } from '@/app/api/staff/hod/timetable-instances/[id]/entries/route';
import { db } from '@/db';
import { FacultyService } from '@/services/FacultyService';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      syllabusSubjects: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null),
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

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
    },
  };
});

vi.mock('@/services/FacultyService', () => ({
  FacultyService: {
    getCurrentAcademicYear: vi.fn().mockResolvedValue('2026-27'),
    getBranchTimetable: vi.fn().mockResolvedValue([
      { id: 1, day_of_week: 'MON', period_number: 1, subject_code: 'CS101', faculty_id: 10 }
    ]),
    updateTimetableAtomic: vi.fn().mockResolvedValue(true),
  },
}));

describe('Timetable Section-Free Endpoints and Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/hod/timetable', () => {
    it('retrieves timetable for branch and semester without section parameter', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        hod_department_code: 'CSE',
      };

      const req = new Request('http://localhost:3000/api/staff/hod/timetable?branch=CSE&semester=1');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(FacultyService.getBranchTimetable).toHaveBeenCalledWith({
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27',
      });
      // Ensure section was not passed
      expect(FacultyService.getBranchTimetable.mock.calls[0][0].section).toBeUndefined();
    });

    it('allows First Year Coordinator to access Semesters 1 and 2 across branches without section', async () => {
      mockCurrentUser = {
        id: 2,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'ECE',
      };

      const req = new Request('http://localhost:3000/api/staff/hod/timetable?branch=CSE&semester=2');
      const res = await GET(req);
      expect(res.status).toBe(200);

      expect(FacultyService.getBranchTimetable).toHaveBeenCalledWith({
        branch: 'CSE',
        semester: 2,
        academicYear: '2026-27',
      });
    });

    it('rejects First Year Coordinator for Semester 3 outside authorized first-year scope', async () => {
      mockCurrentUser = {
        id: 2,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'ECE',
      };

      const req = new Request('http://localhost:3000/api/staff/hod/timetable?branch=CSE&semester=3');
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/staff/hod/timetable', () => {
    it('creates or upserts a timetable slot without requiring section in payload', async () => {
      getAuthUser.mockImplementation(async (role) => {
        if (role === 'hod' || role === 'faculty') {
          return {
            id: 1,
            role: 'faculty',
            is_hod: true,
            branch: 'CSE',
            hod_department_code: 'CSE',
          };
        }
        return null;
      });

      db.query.syllabusSubjects.findFirst.mockResolvedValue({
        subject_code: 'CS101',
        branch: 'CSE',
        semester: 1,
      });

      const conflictChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      db.select.mockReturnValue(conflictChain);

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onDuplicateKeyUpdate: vi.fn().mockResolvedValue({}),
      };
      db.insert.mockReturnValue(insertChain);

      const req = new Request('http://localhost:3000/api/staff/hod/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'CSE',
          semester: 1,
          day_of_week: 'MON',
          period_number: 1,
          subject_code: 'CS101',
          faculty_id: 15,
          room_no: '101',
          academic_year: '2026-27',
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify slotData passed to db.insert did not include section
      const insertedSlot = insertChain.values.mock.calls[0][0];
      expect(insertedSlot.section).toBeUndefined();
      expect(insertedSlot.branch).toBe('CSE');
      expect(insertedSlot.semester).toBe(1);
      expect(insertedSlot.period_number).toBe(1);
    });
  });

  describe('DELETE /api/staff/hod/timetable', () => {
    it('deletes slot without section parameter', async () => {
      getAuthUser.mockImplementation(async (role) => {
        if (role === 'hod' || role === 'faculty') {
          return {
            id: 1,
            role: 'faculty',
            is_hod: true,
            branch: 'CSE',
            hod_department_code: 'CSE',
          };
        }
        return null;
      });

      const deleteChain = {
        where: vi.fn().mockResolvedValue({}),
      };
      db.delete.mockReturnValue(deleteChain);

      const req = new Request('http://localhost:3000/api/staff/hod/timetable?branch=CSE&semester=1&day_of_week=MON&period_number=1', {
        method: 'DELETE',
      });

      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('clears entire semester without section parameter', async () => {
      getAuthUser.mockImplementation(async (role) => {
        if (role === 'hod' || role === 'faculty') {
          return {
            id: 1,
            role: 'faculty',
            is_hod: true,
            branch: 'CSE',
            hod_department_code: 'CSE',
          };
        }
        return null;
      });

      const deleteChain = {
        where: vi.fn().mockResolvedValue({}),
      };
      db.delete.mockReturnValue(deleteChain);

      const req = new Request('http://localhost:3000/api/staff/hod/timetable?branch=CSE&semester=1&action=clearSemester', {
        method: 'DELETE',
      });

      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('POST /api/staff/hod/timetable-instances/[id]/entries', () => {
    it('upserts slot entry without section field', async () => {
      mockCurrentUser = {
        id: 1,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        hod_department_code: 'CSE',
      };

      // Mock finding instance
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: 10,
            branch: 'CSE',
            semester: 1,
            academic_year: '2026-27',
            status: 'DRAFT',
          }]),
        }),
      });

      // Mock existing slot query (returns empty)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock faculty legitimacy check
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 15 }]),
              }),
            }),
          }),
        }),
      });

      // Mock conflict check (returns empty)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const insertChain = {
        values: vi.fn().mockResolvedValue({}),
      };
      db.insert.mockReturnValue(insertChain);

      const req = new Request('http://localhost:3000/api/staff/hod/timetable-instances/10/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: 'MON',
          period_number: 1,
          subject_code: 'CS101',
          faculty_id: 15,
          room_no: '101',
        }),
      });

      const res = await postEntry(req, { params: Promise.resolve({ id: '10' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      const insertedSlot = insertChain.values.mock.calls[0][0];
      expect(insertedSlot.section).toBeUndefined();
    });
  });
});
