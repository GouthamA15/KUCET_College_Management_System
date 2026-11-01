import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockAuthUser = null;

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name) => {
      if ((name === 'staff_auth' || name === 'admin_auth') && mockAuthUser) {
        return { value: 'mock_valid_token' };
      }
      return undefined;
    }),
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(async (token) => {
    if (token === 'mock_valid_token') return mockAuthUser;
    return null;
  }),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

vi.mock('@/services/academic/AcademicMonitoringService', () => ({
  AcademicMonitoringService: {
    getAcademicOverview: vi.fn(),
    getCohortAttendance: vi.fn(),
    getCohortMarks: vi.fn(),
    getCombinedAcademicData: vi.fn(),
    getStudentAcademicDetails: vi.fn(),
    generateCsvExport: vi.fn(),
  },
}));

vi.mock('@/pdf/templates/AcademicMonitoringReportPDF', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test mock pdf')),
  })),
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s) => s },
  Font: { register: vi.fn() },
}));

import { GET as getOverview } from '@/app/api/staff/academic-monitoring/overview/route';
import { GET as getAttendance } from '@/app/api/staff/academic-monitoring/attendance/route';
import { GET as getMarks } from '@/app/api/staff/academic-monitoring/marks/route';
import { GET as getCombined } from '@/app/api/staff/academic-monitoring/combined/route';
import { GET as getStudentDetails } from '@/app/api/staff/academic-monitoring/students/[studentId]/route';
import { GET as getCsvExport } from '@/app/api/staff/academic-monitoring/export/csv/route';
import { GET as getPdfExport } from '@/app/api/staff/academic-monitoring/export/pdf/route';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';

describe('Academic Monitoring API Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = null;
  });

  const coordinatorUser = {
    id: 101,
    role: 'faculty',
    is_first_year_coordinator: true,
    branch: 'CSE',
  };

  describe('GET /api/staff/academic-monitoring/overview', () => {
    it('returns 401 when request is unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/overview?branch=CSE&semester=1');
      const res = await getOverview(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with cohort overview data when authorized', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getAcademicOverview.mockResolvedValue({
        scope: { branch: 'CSE', semester: 1 },
        kpis: { totalStudents: 60, averageAttendance: 85.5 },
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/overview?branch=CSE&semester=1');
      const res = await getOverview(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.kpis.totalStudents).toBe(60);
      expect(AcademicMonitoringService.getAcademicOverview).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'CSE', semester: '1' })
      );
    }, 15000);

    it('returns 403 when scope resolution forbids the requested semester', async () => {
      mockAuthUser = coordinatorUser;
      const forbiddenErr = new Error('Access forbidden to semester 3 for role First-Year Coordinator');
      forbiddenErr.statusCode = 403;
      AcademicMonitoringService.getAcademicOverview.mockRejectedValue(forbiddenErr);

      const req = new Request('http://localhost/api/staff/academic-monitoring/overview?branch=CSE&semester=3');
      const res = await getOverview(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Access forbidden');
    });
  });

  describe('GET /api/staff/academic-monitoring/attendance', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/attendance');
      const res = await getAttendance(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with attendance grid data', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getCohortAttendance.mockResolvedValue({
        scope: { branch: 'ECE', semester: 2 },
        students: [{ student_id: 1, roll_no: '24091A1501', overall_percentage: 91.2 }],
        subjects: [{ id: 10, code: 'EC201', name: 'Electronic Devices' }],
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/attendance?branch=ECE&semester=2');
      const res = await getAttendance(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.students).toHaveLength(1);
    });
  });

  describe('GET /api/staff/academic-monitoring/marks', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/marks');
      const res = await getMarks(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with cohort marks data', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getCohortMarks.mockResolvedValue({
        scope: { branch: 'CSE', semester: 1 },
        students: [{ student_id: 1, roll_no: '24091A0901', subjects: {} }],
        subjects: [],
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/marks?branch=CSE&semester=1');
      const res = await getMarks(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.students).toHaveLength(1);
    });
  });

  describe('GET /api/staff/academic-monitoring/combined', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/combined');
      const res = await getCombined(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with combined attendance and marks analysis', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getCombinedAcademicData.mockResolvedValue({
        scope: { branch: 'CSE', semester: 1 },
        students: [{ student_id: 1, roll_no: '24091A0901', category: 'ATTENDANCE_ATTENTION_REQUIRED' }],
        distribution: { ATTENDANCE_ATTENTION_REQUIRED: 1 },
        condonationList: [],
        consecutiveAbsenceList: [],
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/combined?branch=CSE&semester=1');
      const res = await getCombined(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.students[0].category).toBe('ATTENDANCE_ATTENTION_REQUIRED');
    });
  });

  describe('GET /api/staff/academic-monitoring/students/[studentId]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/students/45');
      const res = await getStudentDetails(req, { params: Promise.resolve({ studentId: '45' }) });
      expect(res.status).toBe(401);
    });

    it('returns 400 when studentId is invalid', async () => {
      mockAuthUser = coordinatorUser;
      const req = new Request('http://localhost/api/staff/academic-monitoring/students/not-a-number');
      const res = await getStudentDetails(req, { params: Promise.resolve({ studentId: 'not-a-number' }) });
      expect(res.status).toBe(400);
    });

    it('returns 403 when IDOR check detects foreign student', async () => {
      mockAuthUser = coordinatorUser;
      const idorErr = new Error('Access denied: Student does not belong to authorized branch or study level');
      idorErr.statusCode = 403;
      AcademicMonitoringService.getStudentAcademicDetails.mockRejectedValue(idorErr);

      const req = new Request('http://localhost/api/staff/academic-monitoring/students/999');
      const res = await getStudentDetails(req, { params: Promise.resolve({ studentId: '999' }) });
      expect(res.status).toBe(403);
    });

    it('returns 200 with full student academic details', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getStudentAcademicDetails.mockResolvedValue({
        student: { id: 45, name: 'John Doe', roll_no: '24091A0901' },
        attendance: { overall_percentage: 88.0, subject_breakdown: [] },
        marks: { subject_marks: [] },
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/students/45');
      const res = await getStudentDetails(req, { params: Promise.resolve({ studentId: '45' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.student.name).toBe('John Doe');
    });
  });

  describe('GET /api/staff/academic-monitoring/export/csv', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/export/csv?type=attendance');
      const res = await getCsvExport(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with text/csv header and attachment disposition', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.generateCsvExport.mockResolvedValue('"Roll No","Name"\n"24091A0901","John Doe"');

      const req = new Request('http://localhost/api/staff/academic-monitoring/export/csv?type=attendance&branch=CSE&semester=1');
      const res = await getCsvExport(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="KUCET_Academic_Monitoring_CSE_Sem1_ATTENDANCE.csv"');
    });
  });

  describe('GET /api/staff/academic-monitoring/export/pdf', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthUser = null;
      const req = new Request('http://localhost/api/staff/academic-monitoring/export/pdf?type=attendance');
      const res = await getPdfExport(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with application/pdf header', async () => {
      mockAuthUser = coordinatorUser;
      AcademicMonitoringService.getCohortAttendance.mockResolvedValue({
        scope: { branch: 'CSE', semester: 1, academicYear: '2025-26' },
        students: [{ roll_no: '24091A0901', name: 'John Doe', overall_percentage: 88.0, attended_sessions: 44, total_sessions: 50 }],
        subjects: [],
      });

      const req = new Request('http://localhost/api/staff/academic-monitoring/export/pdf?type=attendance&branch=CSE&semester=1');
      const res = await getPdfExport(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
    });
  });
});
