import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/staff/faculty/attendance/session/pdf/route';
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

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf content')),
  })),
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  Text: ({ children }) => children,
  View: ({ children }) => children,
  Image: () => null,
  StyleSheet: {
    create: (styles) => styles,
  },
}));

vi.mock('@/pdf/templates/AttendanceSessionPDF', () => ({
  default: vi.fn(() => null),
}));

describe('Faculty Attendance Session PDF Route (/api/staff/faculty/attendance/session/pdf)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    getAuthUser.mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=1&date=2026-09-18&session=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when required query params are missing', async () => {
    getAuthUser.mockResolvedValue({ id: 10, role: 'faculty' });
    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=1');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when assignment is not found', async () => {
    getAuthUser.mockResolvedValue({ id: 10, role: 'faculty' });
    db.select = vi.fn().mockReturnValueOnce({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=999&date=2026-09-18&session=1');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not authorized for assignment', async () => {
    getAuthUser.mockResolvedValue({ id: 20, role: 'faculty', is_hod: false, branch: 'ECE' });
    
    // Assignment lookup returns assignment owned by faculty 10 in CSE
    db.select = vi.fn()
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 1,
                faculty_id: 10,
                branch: 'CSE',
                subject_name: 'Operating Systems',
                subject_code: 'CS501',
                course_semester: 'S5',
                academic_year: '2026-2027',
              }]),
            }),
          }),
        }),
      })
      // Substitution lookup returns empty
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=1&date=2026-09-18&session=1');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 404 when no attendance records exist for the session', async () => {
    getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', is_hod: false, branch: 'CSE' });

    db.select = vi.fn()
      // Assignment lookup
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 1,
                faculty_id: 10,
                branch: 'CSE',
                subject_name: 'Operating Systems',
                subject_code: 'CS501',
                course_semester: 'S5',
                academic_year: '2026-2027',
              }]),
            }),
          }),
        }),
      })
      // Canonical lookup
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 1 }]),
            }),
          }),
        }),
      })
      // Student attendance query returns empty (session never submitted)
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }),
      });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=1&date=2026-09-18&session=1');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('generates and streams PDF with 200 OK when session was submitted', async () => {
    getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', is_hod: false, branch: 'CSE' });

    db.select = vi.fn()
      // Assignment lookup
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 1,
                faculty_id: 10,
                branch: 'CSE',
                subject_name: 'Operating Systems',
                subject_code: 'CS501',
                course_semester: 'S5',
                academic_year: '2026-2027',
                faculty_name: 'Dr. Ramesh',
              }]),
            }),
          }),
        }),
      })
      // Canonical lookup
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 1 }]),
            }),
          }),
        }),
      })
      // Student attendance query returns 2 students
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { student_id: 1, roll_no: '0122101', name: 'John Doe', status: 'PRESENT', submitted_at: new Date('2026-09-18T10:30:00Z') },
                { student_id: 2, roll_no: '0122102', name: 'Jane Smith', status: 'ABSENT', submitted_at: new Date('2026-09-18T10:30:00Z') },
              ]),
            }),
          }),
        }),
      })
      // Session query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{
              topic_covered: 'Deadlock Detection Algorithms',
              submitted_at: new Date('2026-09-18T10:30:00Z'),
            }]),
          }),
        }),
      });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=1&date=2026-09-18&session=1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attendance_CS501_18_09_2026_S1.pdf');
  });
});
