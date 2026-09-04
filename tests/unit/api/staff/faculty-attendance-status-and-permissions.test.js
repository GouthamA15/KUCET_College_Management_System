import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as statusGET } from '@/app/api/staff/faculty/attendance/status/route';
import { POST as attendancePOST } from '@/app/api/staff/faculty/attendance/route';
import { GET as assignmentsGET } from '@/app/api/staff/faculty/assignments/route';
import { GET as calendarGET } from '@/app/api/staff/academic-calendar/route';
import { AttendanceService } from '@/services/AttendanceService';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
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
  isSemesterActive: vi.fn().mockResolvedValue(true),
  getCurrentCalendarSession: vi.fn().mockResolvedValue({ academicYear: '2026-2027', semester: 1 }),
}));

vi.mock('@/lib/clock', () => ({
  getNow: vi.fn(() => new Date('2026-09-04T10:00:00Z')),
}));

describe('Faculty Attendance Status, Permissions & Topic Persistence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/faculty/attendance/status', () => {
    it('returns attendance status, session list, verified ids, and topic_covered for primary faculty', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        staffId: 10,
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{
              id: 450014,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2026-2027',
              faculty_id: 10
            }])
          })
        })
      });

      // 2. Canonical lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }])
            })
          })
        })
      });

      // 3. Attendance rows
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([
            { student_id: 1, status: 'PRESENT' },
            { student_id: 2, status: 'ABSENT' }
          ])
        })
      });

      // 4. Session rows
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => Promise.resolve([{ session: 1 }])
            })
          })
        })
      });

      // 5. Topic covered query
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ topic_covered: 'Paging and Segmentation' }])
          })
        })
      });

      // 6. Verified logs query
      selectMock.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ student_id: 1 }])
          })
        })
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/status?assignment_id=450014&date=2026-09-04&session=1');
      const res = await statusGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.sessions).toEqual([1]);
      expect(json.verified_ids).toEqual([1]);
      expect(json.topic_covered).toBe('Paging and Segmentation');
    });

    it('allows Admin to view attendance status and topic_covered', async () => {
      getAuthUser.mockResolvedValue({
        id: 999,
        role: 'admin',
      });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{
              id: 450014,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2026-2027',
              faculty_id: 10
            }])
          })
        })
      });

      // 2. Canonical lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }])
            })
          })
        })
      });

      // 3. Attendance rows
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([])
        })
      });

      // 4. Session rows
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => Promise.resolve([])
            })
          })
        })
      });

      // 5. Topic covered query
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([])
          })
        })
      });

      // 6. Verified logs query
      selectMock.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([])
          })
        })
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/status?assignment_id=450014&date=2026-09-04&session=1');
      const res = await statusGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.topic_covered).toBeNull();
    });
  });

  describe('POST /api/staff/faculty/attendance with topic_covered', () => {
    it('accepts and saves topic_covered alongside attendance records', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{
              id: 450014,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2026-2027',
              faculty_id: 10
            }])
          })
        })
      });

      // 2. Canonical lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }])
            })
          })
        })
      });

      // 3. College rows
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 1 }])
          })
        })
      });

      // Transaction mock
      db.transaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onDuplicateKeyUpdate: vi.fn().mockResolvedValue(true)
            })
          })
        };
        return callback(tx);
      });

      const spyUpdateTopic = vi.spyOn(AttendanceService, 'updateLectureTopic').mockResolvedValue({
        success: true,
        topic_covered: 'Deadlock Detection & Recovery'
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 450014,
          date: '2026-09-04',
          session: 1,
          topic_covered: 'Deadlock Detection & Recovery',
          attendance_data: [
            { student_id: 1, status: 'PRESENT' },
            { student_id: 2, status: 'ABSENT' }
          ]
        })
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.message).toBe('Attendance updated successfully');
      expect(json.topic_covered).toBe('Deadlock Detection & Recovery');
      expect(spyUpdateTopic).toHaveBeenCalledWith({
        assignmentId: 450014,
        date: '2026-09-04',
        sessionNumber: 1,
        topicCovered: 'Deadlock Detection & Recovery',
        user: expect.objectContaining({ id: 10 })
      });
    });
  });

  describe('GET /api/staff/academic-calendar permissions', () => {
    it('allows regular faculty member to read calendar without HOD role error', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      db.select = vi.fn().mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([
            { date: '2026-09-04', day_type: 'WORKING', holiday_name: null }
          ])
        })
      });

      const req = new Request('http://localhost:3000/api/staff/academic-calendar?academic_year=2026-2027&semester=1&month=9&year=2026');
      const res = await calendarGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].day_type).toBe('WORKING');
    });
  });

  describe('GET /api/staff/faculty/assignments lookup', () => {
    it('supports targeted assignment lookup by ?id= parameter', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      db.select = vi.fn()
        // Substitute lookup
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([])
          })
        })
        // Assignment query
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{
              id: 450014,
              staff_account_id: 10,
              subject_code: 'CS301',
              subject_name: 'Operating Systems',
              branch: 'CSE',
              course_semester: 5,
              semester: 5,
              academic_term: 1,
              academic_year: '2026-2027',
              is_active: true
            }])
          })
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/assignments?id=450014');
      const res = await assignmentsGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe(450014);
      expect(json.data[0].subject_name).toBe('Operating Systems');
    });
  });
});
