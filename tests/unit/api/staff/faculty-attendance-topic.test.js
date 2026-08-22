import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH as topicPATCH } from '@/app/api/staff/faculty/attendance/session/topic/route';
import { POST as attendancePOST } from '@/app/api/staff/faculty/attendance/route';
import { getAuthUser } from '@/lib/api-utils';
import { AttendanceService } from '@/services/AttendanceService';
import { db } from '@/db';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/services/AttendanceService', () => ({
  AttendanceService: {
    updateLectureTopic: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  isSemesterActive: vi.fn().mockResolvedValue(true),
}));

const makeRequest = (body, method = 'PATCH') => new Request('http://localhost:3000/api/staff/faculty/attendance/session/topic', {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('Faculty Attendance & Topic API Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/staff/faculty/attendance/session/topic', () => {
    it('successfully updates lecture topic for authenticated faculty', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        staffId: 10,
        email: 'faculty@kucet.ac.in',
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      AttendanceService.updateLectureTopic.mockResolvedValue({
        success: true,
        message: 'Lecture topic updated successfully',
        topic_covered: 'Binary Search Trees & AVL Rotations',
      });

      const req = makeRequest({
        assignment_id: 101,
        date: '2026-08-22',
        session: 2,
        topic_covered: 'Binary Search Trees & AVL Rotations',
      });

      const res = await topicPATCH(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.topic_covered).toBe('Binary Search Trees & AVL Rotations');
      expect(AttendanceService.updateLectureTopic).toHaveBeenCalledWith({
        assignmentId: 101,
        date: '2026-08-22',
        sessionNumber: 2,
        topicCovered: 'Binary Search Trees & AVL Rotations',
        user: expect.objectContaining({ id: 10, role: 'faculty' }),
      });
    });

    it('rejects empty topic with 400 Bad Request', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
      });

      const req = makeRequest({
        assignment_id: 101,
        date: '2026-08-22',
        session: 2,
        topic_covered: '',
      });

      const res = await topicPATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('minimum 2 characters');
    });

    it('rejects whitespace-only topic with 400 Bad Request', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
      });

      const req = makeRequest({
        assignment_id: 101,
        date: '2026-08-22',
        session: 2,
        topic_covered: '    ',
      });

      const res = await topicPATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('minimum 2 characters');
    });

    it('rejects unauthenticated user with 401 Unauthorized', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = makeRequest({
        assignment_id: 101,
        date: '2026-08-22',
        session: 2,
        topic_covered: 'Operating Systems Scheduling',
      });

      const res = await topicPATCH(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-faculty / legacy role with 401 Unauthorized', async () => {
      getAuthUser.mockResolvedValue({
        id: 20,
        role: 'clerk',
      });

      const req = makeRequest({
        assignment_id: 101,
        date: '2026-08-22',
        session: 2,
        topic_covered: 'Operating Systems Scheduling',
      });

      const res = await topicPATCH(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/staff/faculty/attendance', () => {
    it('rejects unauthenticated access with 401', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 101,
          date: '2026-08-22',
          session: 1,
          attendance_data: [{ student_id: 1, status: 'PRESENT' }],
        }),
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized faculty from marking another faculty assignment with 403', async () => {
      getAuthUser.mockResolvedValue({
        id: 99,
        role: 'faculty',
        branch: 'ECE',
        is_hod: false,
      });

      // Assignment belongs to faculty 10
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{
              id: 101,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2025-2026',
              faculty_id: 10,
            }]),
          }),
        }),
      });

      // Substitution check returns empty
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 101,
          date: '2026-08-22',
          session: 1,
          attendance_data: [{ student_id: 1, status: 'PRESENT' }],
        }),
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(403);
    });
  });
});
