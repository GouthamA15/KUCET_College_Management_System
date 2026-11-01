import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as fullExportPDFGET } from '@/app/api/staff/faculty/attendance/export/pdf/route';
import { GET as fullExportCSVGET } from '@/app/api/staff/faculty/attendance/export/csv/route';
import { db } from '@/db';
import { getAuthUser } from '@/lib/api-utils';

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 Mock PDF Stream')),
  })),
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  View: ({ children }) => children,
  Text: ({ children }) => children,
  Image: () => null,
  StyleSheet: {
    create: (styles) => styles,
  },
}));

vi.mock('@/pdf/templates/FullAttendanceExportPDF', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/clock', () => {
  const mockNow = new Date('2026-10-28T12:00:00Z');
  return {
    getNow: vi.fn(() => mockNow),
    Clock: {
      now: vi.fn(() => mockNow),
      nowString: vi.fn(() => '2026-10-28 12:00:00'),
      toIST: vi.fn(() => mockNow),
    },
    default: {
      now: vi.fn(() => mockNow),
    },
  };
});

describe('Full Attendance Export API Suite (PDF & CSV)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization and Validation', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      getAuthUser.mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=450014');
      const res = await fullExportPDFGET(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid or missing assignment_id with 400 Bad Request', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE' });
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=invalid');
      const res = await fullExportPDFGET(req);
      expect(res.status).toBe(400);
    });

    it('returns 404 when assignment does not exist', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE' });
      db.select = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=999999');
      const res = await fullExportPDFGET(req);
      expect(res.status).toBe(404);
    });

    it('rejects unauthorized faculty from exporting another faculty member assignment with 403', async () => {
      getAuthUser.mockResolvedValue({ id: 99, role: 'faculty', branch: 'ECE', is_hod: false });
      
      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup: owned by faculty 10 in CSE
      selectMock.mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 450014,
                subject_name: 'Operating Systems',
                subject_code: 'CS301',
                branch: 'CSE',
                course_semester: 5,
                academic_year: '2026-2027',
                faculty_id: 10,
                faculty_name: 'Dr. John Doe'
              }]),
            }),
          }),
        }),
      });

      // 2. Substitute lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=450014');
      const res = await fullExportPDFGET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('PDF Export Execution', () => {
    it('returns 404 when assignment has no submitted attendance sessions', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE' });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 450014,
                subject_name: 'Operating Systems',
                subject_code: 'CS301',
                branch: 'CSE',
                course_semester: 5,
                academic_year: '2026-2027',
                faculty_id: 10,
                faculty_name: 'Dr. John Doe'
              }]),
            }),
          }),
        }),
      });

      // 2. Canonical assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }]),
            }),
          }),
        }),
      });

      // 3. Attendance records: empty
      selectMock.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=450014');
      const res = await fullExportPDFGET(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('No submitted attendance records found');
    });

    it('generates landscape PDF with full canonical roster and submitted sessions', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE' });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 450014,
                subject_name: 'Operating Systems',
                subject_code: 'CS301',
                branch: 'CSE',
                course_semester: 5,
                academic_year: '2026-2027',
                faculty_id: 10,
                faculty_name: 'Dr. John Doe'
              }]),
            }),
          }),
        }),
      });

      // 2. Canonical assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }]),
            }),
          }),
        }),
      });

      // 3. Committed attendance records (2 sessions: S1, S2)
      selectMock.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                {
                  student_id: 1,
                  roll_no: '24567T0901',
                  name: 'Alice Smith',
                  date: '2026-09-04',
                  session: 1,
                  status: 'PRESENT',
                  submitted_at: '2026-09-04T10:05:00Z'
                },
                {
                  student_id: 2,
                  roll_no: '24567T0902',
                  name: 'Bob Jones',
                  date: '2026-09-04',
                  session: 1,
                  status: 'ABSENT',
                  submitted_at: '2026-09-04T10:05:00Z'
                },
                // Session 2: All absent session (legitimately submitted)
                {
                  student_id: 1,
                  roll_no: '24567T0901',
                  name: 'Alice Smith',
                  date: '2026-09-05',
                  session: 1,
                  status: 'ABSENT',
                  submitted_at: '2026-09-05T11:00:00Z'
                },
                {
                  student_id: 2,
                  roll_no: '24567T0902',
                  name: 'Bob Jones',
                  date: '2026-09-05',
                  session: 1,
                  status: 'ABSENT',
                  submitted_at: '2026-09-05T11:00:00Z'
                }
              ]),
            }),
          }),
        }),
      });

      // 4. Session metadata (topics)
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([
            {
              date: '2026-09-04',
              session: 1,
              topic_covered: 'OS Process Management',
              submitted_at: '2026-09-04T10:05:00Z'
            },
            {
              date: '2026-09-05',
              session: 1,
              topic_covered: 'Inter-Process Communication',
              submitted_at: '2026-09-05T11:00:00Z'
            }
          ]),
        }),
      });

      // 5. Eligible cohort lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              { id: 1, roll_no: '24567T0901', name: 'Alice Smith' },
              { id: 2, roll_no: '24567T0902', name: 'Bob Jones' },
              { id: 3, roll_no: '24567T0903', name: 'Charlie Brown' } // Enrolled student with zero marked sessions
            ]),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=450014');
      const res = await fullExportPDFGET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toContain('attendance_register_CS301_CSE_Sem5.pdf');

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('CSV Export Execution', () => {
    it('generates standard CSV with student rows, session headers, and presence counts', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE' });

      const selectMock = vi.fn();
      db.select = selectMock;

      // 1. Assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 450014,
                subject_name: 'Operating Systems',
                subject_code: 'CS301',
                branch: 'CSE',
                course_semester: 5,
                academic_year: '2026-2027',
                faculty_id: 10,
                faculty_name: 'Dr. John Doe'
              }]),
            }),
          }),
        }),
      });

      // 2. Canonical assignment lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 450014 }]),
            }),
          }),
        }),
      });

      // 3. Attendance records
      selectMock.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                {
                  student_id: 1,
                  roll_no: '24567T0901',
                  name: 'Alice Smith',
                  date: '2026-09-04',
                  session: 1,
                  status: 'PRESENT'
                },
                {
                  student_id: 2,
                  roll_no: '24567T0902',
                  name: 'Bob Jones',
                  date: '2026-09-04',
                  session: 1,
                  status: 'ABSENT'
                }
              ]),
            }),
          }),
        }),
      });

      // 4. Session metadata
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([
            {
              date: '2026-09-04',
              session: 1,
              topic_covered: 'OS Process Management'
            }
          ]),
        }),
      });

      // 5. Eligible cohort lookup
      selectMock.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              { id: 1, roll_no: '24567T0901', name: 'Alice Smith' },
              { id: 2, roll_no: '24567T0902', name: 'Bob Jones' }
            ]),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/csv?assignment_id=450014');
      const res = await fullExportCSVGET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('attendance_register_CS301_Sem5.csv');

      const csvText = await res.text();
      expect(csvText).toContain('KU COLLEGE OF ENGINEERING & TECHNOLOGY - ATTENDANCE REGISTER');
      expect(csvText).toContain('CS301');
      expect(csvText).toContain('"Roll Number","Student Name"');
      expect(csvText).toContain('04-09-2026 (S1)');
      expect(csvText).toContain('24567T0901');
      expect(csvText).toContain('Alice Smith');
      expect(csvText).toContain('TOTAL PRESENT');
    });
  });
});
