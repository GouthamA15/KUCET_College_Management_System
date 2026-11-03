import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getEligibleSessions } from '@/app/api/staff/faculty/attendance/reuse/eligible-sessions/route';
import { GET as getSessionData } from '@/app/api/staff/faculty/attendance/reuse/session-data/route';
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

describe('Reuse Attendance API Routes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/faculty/attendance/reuse/eligible-sessions', () => {
    it('returns 401 if user is not authenticated', async () => {
      getAuthUser.mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/eligible-sessions?assignment_id=101');
      const res = await getEligibleSessions(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 if assignment_id is missing', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty' });
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/eligible-sessions');
      const res = await getEligibleSessions(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('assignment_id is required');
    });

    it('returns 404 if destination assignment does not exist', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty' });
      db.select = vi.fn().mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/eligible-sessions?assignment_id=999');
      const res = await getEligibleSessions(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Destination assignment not found');
    });

    it('returns 403 if faculty is not authorized for the destination assignment', async () => {
      getAuthUser.mockResolvedValue({ id: 99, role: 'faculty', branch: 'CIVIL', is_hod: false });
      // 1. Destination assignment query (faculty_id = 5, branch = 'EEE')
      db.select = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 101,
                faculty_id: 5,
                branch: 'EEE',
                course_semester: 1,
                academic_year: '2026-2027',
              }]),
            }),
          }),
        })
        // 2. Substitute check query
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/eligible-sessions?assignment_id=101');
      const res = await getEligibleSessions(req);
      expect(res.status).toBe(403);
    });

    it('returns eligible sessions for the matching cohort', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty', branch: 'EEE' });
      // 1. Destination assignment query
      db.select = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 101,
                faculty_id: 5,
                branch: 'EEE',
                course_semester: 1,
                academic_year: '2026-2027',
                subject_name: 'Engineering Mechanics',
                subject_code: 'ME101',
              }]),
            }),
          }),
        })
        // 2. Eligible sessions query (Physics lecture conducted earlier)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => Promise.resolve([
                      {
                        session_id: 50,
                        assignment_id: 102,
                        subject_name: 'Engineering Physics',
                        subject_code: 'PH101',
                        faculty_id: 8,
                        faculty_name: 'Dr. Physics',
                        attendance_date: '2026-11-03',
                        session_number: 1,
                        total_students: 65,
                        present_count: 60,
                        absent_count: 5,
                        topic_covered: 'Kinematics',
                        submitted_at: new Date('2026-11-03T10:00:00Z'),
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/eligible-sessions?assignment_id=101');
      const res = await getEligibleSessions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(1);
      expect(data.sessions[0].subject_name).toBe('Engineering Physics');
      expect(data.sessions[0].subject_type).toBe('Theory');
      expect(data.sessions[0].present_count).toBe(60);
      expect(data.cohort.branch).toBe('EEE');
    });
  });

  describe('GET /api/staff/faculty/attendance/reuse/session-data', () => {
    it('returns 400 if required query params are missing', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty' });
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/session-data?destination_assignment_id=101');
      const res = await getSessionData(req);
      expect(res.status).toBe(400);
    });

    it('rejects cross-cohort reuse with 400 when cohorts do not match', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty', branch: 'EEE' });
      // 1. Destination assignment (EEE, Sem 1, 2026-2027)
      db.select = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 101,
                faculty_id: 5,
                branch: 'EEE',
                course_semester: 1,
                academic_year: '2026-2027',
              }]),
            }),
          }),
        })
        // 2. Source session
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{
                  id: 200,
                  assignment_id: 999,
                  attendance_date: '2026-11-03',
                  session_number: 1,
                }]),
              }),
            }),
          }),
        })
        // 3. Source assignment (CSE, Sem 1, 2026-2027 - Different Branch!)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 999,
                branch: 'CSE',
                course_semester: 1,
                academic_year: '2026-2027',
                subject_name: 'Python Programming',
                subject_code: 'CS101',
              }]),
            }),
          }),
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/session-data?destination_assignment_id=101&source_session_id=200');
      const res = await getSessionData(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cohort mismatch');
    });

    it('successfully extracts matched attendance records and identifies missing lateral students', async () => {
      getAuthUser.mockResolvedValue({ id: 5, role: 'faculty', branch: 'EEE' });
      // 1. Destination assignment (EEE, Sem 3, 2026-2027)
      db.select = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 101,
                faculty_id: 5,
                branch: 'EEE',
                course_semester: 3,
                academic_year: '2026-2027',
                subject_name: 'Electrical Machines',
                subject_code: 'EE301',
              }]),
            }),
          }),
        })
        // 2. Source session
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{
                  id: 200,
                  assignment_id: 102,
                  attendance_date: '2026-11-03',
                  session_number: 1,
                  total_students: 2,
                  present_count: 2,
                  absent_count: 0,
                  faculty_name: 'Prof. Circuits',
                }]),
              }),
            }),
          }),
        })
        // 3. Source assignment (Same cohort: EEE, Sem 3, 2026-2027)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 102,
                branch: 'EEE',
                course_semester: 3,
                academic_year: '2026-2027',
                subject_name: 'Network Theory',
                subject_code: 'EE302',
              }]),
            }),
          }),
        })
        // 4. Destination student roster query (Students 1, 2, and Lateral Entry 3)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { id: 1, roll_no: '24567T0901', name: 'Student 1' },
                { id: 2, roll_no: '24567T0902', name: 'Student 2' },
                { id: 3, roll_no: '255670901L', name: 'Lateral 1' },
              ]),
            }),
          }),
        })
        // 5. Source attendance records query (Has attendance for Student 1 and Student 2 only)
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([
              { student_id: 1, status: 'PRESENT' },
              { student_id: 2, status: 'ABSENT' },
            ]),
          }),
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/reuse/session-data?destination_assignment_id=101&source_session_id=200');
      const res = await getSessionData(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.matched_count).toBe(2);
      expect(data.attendance_records).toEqual([
        { student_id: 1, status: 'PRESENT' },
        { student_id: 2, status: 'ABSENT' },
      ]);
      expect(data.missing_students).toHaveLength(1);
      expect(data.missing_students[0].roll_no).toBe('255670901L');
      expect(data.is_fully_compatible).toBe(false);
      expect(data.source_session.subject_name).toBe('Network Theory');
    });
  });
});
