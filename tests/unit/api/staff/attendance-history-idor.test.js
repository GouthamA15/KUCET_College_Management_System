import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/staff/faculty/attendance/history/route';
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

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Attendance History IDOR & Authorization Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    getAuthUser.mockResolvedValue(null);
    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=50&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rejects unauthorized faculty attempting to access another faculty subject assignment (IDOR prevention)', async () => {
    getAuthUser.mockResolvedValue({
      id: 99,
      role: 'faculty',
      branch: 'MECH',
      is_hod: false,
      is_first_year_coordinator: false
    });

    // Mock assignment belonging to staff_account_id: 10, CSE, semester 4
    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 50,
          faculty_id: 10,
          subject_code: 'CS401',
          branch: 'CSE',
          course_semester: 4,
          academic_year: '2025-26',
          is_active: true
        }])
      })
      // Mock substitution check returning empty
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=50&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });

  it('allows the assigned primary faculty to view their attendance history', async () => {
    getAuthUser.mockResolvedValue({
      id: 10,
      role: 'faculty',
      branch: 'CSE',
      is_hod: false
    });

    // Mock assignment lookup
    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 50,
          faculty_id: 10,
          subject_code: 'CS401',
          branch: 'CSE',
          course_semester: 4,
          academic_year: '2025-26',
          is_active: true
        }])
      })
      // Mock history records query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { date: '2026-09-01', status: 'PRESENT', session: 1 }
        ])
      });

    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=50&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.length).toBe(1);
    expect(data.data[0].status).toBe('PRESENT');
  });

  it('allows HOD overseeing CSE to inspect attendance history', async () => {
    getAuthUser.mockResolvedValue({
      id: 20,
      role: 'faculty',
      branch: 'CSE',
      is_hod: true,
      authorized_branches: ['CSE', 'IT']
    });

    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 50,
          faculty_id: 10,
          subject_code: 'CS401',
          branch: 'CSE',
          course_semester: 4,
          academic_year: '2025-26',
          is_active: true
        }])
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      });

    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=50&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('allows First Year Coordinator to inspect history for Semester 1 or 2 across branches', async () => {
    getAuthUser.mockResolvedValue({
      id: 30,
      role: 'faculty',
      branch: 'ECE',
      is_first_year_coordinator: true
    });

    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 60,
          faculty_id: 15,
          subject_code: 'ME101',
          branch: 'MECH',
          course_semester: 1, // First year
          academic_year: '2025-26',
          is_active: true
        }])
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      });

    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=60&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('rejects First Year Coordinator attempting to inspect Semester 4 attendance history', async () => {
    getAuthUser.mockResolvedValue({
      id: 30,
      role: 'faculty',
      branch: 'ECE',
      is_first_year_coordinator: true
    });

    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 70,
          faculty_id: 15,
          subject_code: 'CS401',
          branch: 'CSE',
          course_semester: 4, // Upper year
          academic_year: '2025-26',
          is_active: true
        }])
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

    const req = new Request('http://localhost/api/staff/faculty/attendance/history?assignment_id=70&student_id=101');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
