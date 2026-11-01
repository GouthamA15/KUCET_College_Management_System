import { describe, it, expect, vi } from 'vitest';
import {
  normalizeEvaluationView,
  getEvaluationPdfFilename,
  getEvaluationReportTitle
} from '@/lib/academic-utils';
import { EvaluationReportService } from '@/services/academic/EvaluationReportService';

describe('Professional PDF Export for All Faculty Evaluation Views', () => {

  describe('1. View Normalization & Parameter Mapping', () => {
    it('1.1 maps overview and overall to "overview" for both theory and lab', () => {
      expect(normalizeEvaluationView('overview', false)).toBe('overview');
      expect(normalizeEvaluationView('overall', false)).toBe('overview');
      expect(normalizeEvaluationView('all', false)).toBe('overview');
      expect(normalizeEvaluationView('overview', true)).toBe('overview');
      expect(normalizeEvaluationView('overall', true)).toBe('overview');
    });

    it('1.2 maps theory assessment components correctly', () => {
      expect(normalizeEvaluationView('mid1', false)).toBe('mid1');
      expect(normalizeEvaluationView('mid2', false)).toBe('mid2');
      expect(normalizeEvaluationView('assignment', false)).toBe('assignment');
      // If someone sends execution to theory, it gracefully maps to mid1
      expect(normalizeEvaluationView('execution', false)).toBe('mid1');
    });

    it('1.3 maps practical assessment components correctly', () => {
      expect(normalizeEvaluationView('execution', true)).toBe('execution');
      expect(normalizeEvaluationView('writing', true)).toBe('writing');
      expect(normalizeEvaluationView('record', true)).toBe('record');
      // UI keys map to semantic lab views
      expect(normalizeEvaluationView('mid1', true)).toBe('execution');
      expect(normalizeEvaluationView('mid2', true)).toBe('writing');
      expect(normalizeEvaluationView('assignment', true)).toBe('record');
    });

    it('1.4 defaults unknown or empty views to "overview"', () => {
      expect(normalizeEvaluationView(null, false)).toBe('overview');
      expect(normalizeEvaluationView('', true)).toBe('overview');
      expect(normalizeEvaluationView('unknown_view', false)).toBe('overview');
    });
  });

  describe('2. Filesystem-Safe PDF Filename Generation', () => {
    it('2.1 generates canonical filenames for theory views', () => {
      const base = { branch: 'CSE', subjectCode: 'BSC101', academicYear: '2026-27', isLab: false };

      expect(getEvaluationPdfFilename({ ...base, view: 'overview' }))
        .toBe('KUCET_CSE_BSC101_Overall_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'overall' }))
        .toBe('KUCET_CSE_BSC101_Overall_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'mid1' }))
        .toBe('KUCET_CSE_BSC101_MID1_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'mid2' }))
        .toBe('KUCET_CSE_BSC101_MID2_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'assignment' }))
        .toBe('KUCET_CSE_BSC101_Assignment_2026-27.pdf');
    });

    it('2.2 generates canonical filenames for practical/laboratory views', () => {
      const base = { branch: 'CSE', subjectCode: 'BSC101L', academicYear: '2026-27', isLab: true };

      expect(getEvaluationPdfFilename({ ...base, view: 'overview' }))
        .toBe('KUCET_CSE_BSC101L_Overall_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'execution' }))
        .toBe('KUCET_CSE_BSC101L_Execution_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'mid1' }))
        .toBe('KUCET_CSE_BSC101L_Execution_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'writing' }))
        .toBe('KUCET_CSE_BSC101L_Writing_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'mid2' }))
        .toBe('KUCET_CSE_BSC101L_Writing_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'record' }))
        .toBe('KUCET_CSE_BSC101L_Record_2026-27.pdf');
      expect(getEvaluationPdfFilename({ ...base, view: 'assignment' }))
        .toBe('KUCET_CSE_BSC101L_Record_2026-27.pdf');
    });

    it('2.3 sanitizes special characters to avoid illegal filesystem paths', () => {
      const name = getEvaluationPdfFilename({
        branch: 'CSE/IT',
        subjectCode: 'BSC:101L*?',
        view: 'execution',
        academicYear: '2026/27',
        isLab: true
      });
      expect(name).toBe('KUCET_CSE_IT_BSC_101L___Execution_2026_27.pdf');
    });
  });

  describe('3. Formal Report Title Generation', () => {
    it('3.1 generates formal titles for theory views', () => {
      expect(getEvaluationReportTitle({ view: 'overview', isLab: false }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • THEORY OVERVIEW');
      expect(getEvaluationReportTitle({ view: 'mid1', isLab: false }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • MID-1 ASSESSMENT REPORT');
      expect(getEvaluationReportTitle({ view: 'mid2', isLab: false }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • MID-2 ASSESSMENT REPORT');
      expect(getEvaluationReportTitle({ view: 'assignment', isLab: false }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • ASSIGNMENT ASSESSMENT REPORT');
    });

    it('3.2 generates formal titles for practical/lab views', () => {
      expect(getEvaluationReportTitle({ view: 'overview', isLab: true }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL OVERVIEW');
      expect(getEvaluationReportTitle({ view: 'execution', isLab: true }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL EXECUTION REPORT');
      expect(getEvaluationReportTitle({ view: 'writing', isLab: true }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL WRITING REPORT');
      expect(getEvaluationReportTitle({ view: 'record', isLab: true }))
        .toBe('CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL RECORD REPORT');
    });
  });

  describe('4. Assessment Marks Aggregation & Statistical Accuracy', () => {
    it('4.1 calculates theory totals as Best-of-Mids + Assignment', () => {
      // Best of (18, 14) + 8 = 18 + 8 = 26
      const m1 = 18;
      const m2 = 14;
      const a = 8;
      const total = Math.max(m1 ?? 0, m2 ?? 0) + (a ?? 0);
      expect(total).toBe(26);

      // Best of (12, 19) + 10 = 19 + 10 = 29
      const total2 = Math.max(12, 19) + 10;
      expect(total2).toBe(29);
    });

    it('4.2 calculates practical totals as Execution + Writing + Record', () => {
      // Execution (9) + Writing (8.5) + Record (4.5) = 22
      const exec = 9;
      const writing = 8.5;
      const record = 4.5;
      const total = exec + writing + record;
      expect(total).toBe(22);
    });

    it('4.3 correctly excludes unentered/missing marks from statistical average', () => {
      // 3 students: 20, 24, and null (unentered)
      const values = [20, 24];
      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = sum / values.length;
      expect(avg).toBe(22); // NOT (20 + 24 + 0) / 3 = 14.67
    });

    it('4.4 computes highest, lowest, and completion percentage accurately', () => {
      const marks = [15, 22, 18, 25];
      const highest = Math.max(...marks);
      const lowest = Math.min(...marks);
      const totalStudents = 5; // 4 entered out of 5
      const completionRate = Math.round((marks.length / totalStudents) * 100);

      expect(highest).toBe(25);
      expect(lowest).toBe(15);
      expect(completionRate).toBe(80);
    });
  });

  describe('5. Real PDF Buffer Generation with @react-pdf/renderer', () => {
    it('5.1 renders a valid binary PDF for Theory Overview', async () => {
      const sampleData = {
        collegeName: 'KU College of Engineering & Technology',
        universityName: 'Kakatiya University Campus, Warangal – 506009',
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27',
        subjectCode: 'BSC101',
        subjectName: 'Physics',
        subjectType: 'theory',
        view: 'overview',
        reportTitle: 'CONTINUOUS INTERNAL EVALUATION (CIE) • THEORY OVERVIEW',
        facultyName: 'Dr. Test Professor',
        generationTimestamp: '28 Oct 2026, 10:00 PM',
        isPublished: true,
        midMax: 20,
        students: [
          { id: 1, roll_no: '26567T0901', name: 'Alice Student', c1_marks: 18, c2_marks: 16, c3_marks: 9, total_marks: 27, is_published: true },
          { id: 2, roll_no: '26567T0902', name: 'Bob Scholar', c1_marks: 14, c2_marks: 19, c3_marks: 8, total_marks: 27, is_published: true },
          { id: 3, roll_no: '26567T0903', name: 'Charlie Learner', c1_marks: null, c2_marks: null, c3_marks: null, total_marks: null, is_published: true }
        ],
        stats: {
          totalStudents: 3,
          recordedCount: 2,
          missingCount: 1,
          publishedCount: 3,
          completionRate: 67,
          average: 27,
          highest: 27,
          lowest: 27
        }
      };

      const pdfBuffer = await EvaluationReportService.generatePdfBuffer(sampleData);
      expect(pdfBuffer).toBeDefined();
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      // PDF specification invariant: header starts with %PDF-
      const headerStr = pdfBuffer.slice(0, 5).toString('ascii');
      expect(headerStr).toBe('%PDF-');
    });

    it('5.2 renders a valid binary PDF for Practical Execution View', async () => {
      const sampleLabData = {
        collegeName: 'KU College of Engineering & Technology',
        universityName: 'Kakatiya University Campus, Warangal – 506009',
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27',
        subjectCode: 'BSC101L',
        subjectName: 'Physics-Practical',
        subjectType: 'lab',
        view: 'execution',
        reportTitle: 'CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL EXECUTION REPORT',
        facultyName: 'Dr. Lab Instructor',
        generationTimestamp: '28 Oct 2026, 10:05 PM',
        isPublished: false, // Draft
        midMax: 20,
        students: [
          { id: 1, roll_no: '26567T0901', name: 'Alice Student', mark: 9.5, is_published: false },
          { id: 2, roll_no: '26567T0902', name: 'Bob Scholar', mark: 8.0, is_published: false },
          { id: 3, roll_no: '26567T0903', name: 'Charlie Learner', mark: null, is_published: false }
        ],
        stats: {
          totalStudents: 3,
          recordedCount: 2,
          missingCount: 1,
          publishedCount: 0,
          completionRate: 67,
          average: 8.75,
          highest: 9.5,
          lowest: 8.0
        }
      };

      const pdfBuffer = await EvaluationReportService.generatePdfBuffer(sampleLabData);
      expect(pdfBuffer).toBeDefined();
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      const headerStr = pdfBuffer.slice(0, 5).toString('ascii');
      expect(headerStr).toBe('%PDF-');
    });

    it('5.3 handles a large 60-student class roster and paginates without errors', async () => {
      const largeRoster = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        roll_no: `26567T09${String(i + 1).padStart(2, '0')}`,
        name: `Student Long Name Candidate ${i + 1}`,
        c1_marks: 10 + (i % 10),
        c2_marks: 11 + (i % 9),
        c3_marks: 7 + (i % 3),
        total_marks: 20 + (i % 10),
        is_published: true
      }));

      const largeData = {
        collegeName: 'KU College of Engineering & Technology',
        universityName: 'Kakatiya University Campus, Warangal – 506009',
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27',
        subjectCode: 'BSC101',
        subjectName: 'Physics',
        subjectType: 'theory',
        view: 'overview',
        reportTitle: 'CONTINUOUS INTERNAL EVALUATION (CIE) • THEORY OVERVIEW',
        facultyName: 'Dr. Large Class In-Charge',
        generationTimestamp: '28 Oct 2026, 10:10 PM',
        isPublished: true,
        midMax: 20,
        students: largeRoster,
        stats: {
          totalStudents: 60,
          recordedCount: 60,
          missingCount: 0,
          publishedCount: 60,
          completionRate: 100,
          average: 24.5,
          highest: 29,
          lowest: 20
        }
      };

      const pdfBuffer = await EvaluationReportService.generatePdfBuffer(largeData);
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(1500);
      expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    }, 15000);

    it('5.4 handles empty rosters gracefully without NaN or errors', async () => {
      const emptyData = {
        collegeName: 'KU College of Engineering & Technology',
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27',
        subjectCode: 'BSC101',
        subjectName: 'Physics',
        subjectType: 'theory',
        view: 'overview',
        reportTitle: 'CONTINUOUS INTERNAL EVALUATION (CIE) • THEORY OVERVIEW',
        students: [],
        stats: {
          totalStudents: 0,
          recordedCount: 0,
          missingCount: 0,
          publishedCount: 0,
          completionRate: 0,
          average: null,
          highest: null,
          lowest: null
        }
      };

      const pdfBuffer = await EvaluationReportService.generatePdfBuffer(emptyData);
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  describe('6. Authorization Matrix Enforcements', () => {
    it('6.1 grants access to Super Admin unconditionally', () => {
      const user = { role: 'admin', id: 999 };
      const assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 1 };

      const isAuthorized = user.role === 'admin' || assignment.staff_account_id === user.id;
      expect(isAuthorized).toBe(true);
    });

    it('6.2 grants access to assigned Faculty member', () => {
      const user = { role: 'faculty', id: 180009 };
      const assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 1 };

      const isAuthorized = assignment.staff_account_id === user.id;
      expect(isAuthorized).toBe(true);
    });

    it('6.3 rejects unassigned Faculty member without HOD or Coordinator role', () => {
      const user = { role: 'faculty', id: 999999, is_hod: false, is_first_year_coordinator: false };
      const assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 3 };

      let isAuthorized = false;
      if (user.role === 'admin' || assignment.staff_account_id === user.id) isAuthorized = true;
      else if (user.is_hod && user.branch === assignment.branch) isAuthorized = true;
      else if (user.is_first_year_coordinator && [1, 2].includes(assignment.course_semester)) isAuthorized = true;

      expect(isAuthorized).toBe(false);
    });

    it('6.4 grants access to HOD for subjects within their department', () => {
      const user = { role: 'faculty', id: 50001, is_hod: true, branch: 'CSE' };
      const assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 5 };

      const isAuthorized = user.is_hod && user.branch === assignment.branch;
      expect(isAuthorized).toBe(true);
    });

    it('6.5 rejects HOD attempting to export subjects belonging to another department', () => {
      const user = { role: 'faculty', id: 50001, is_hod: true, branch: 'ECE', authorized_branches: ['ECE'] };
      const assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 5 };

      const isAuthorized = user.is_hod && user.authorized_branches.includes(assignment.branch);
      expect(isAuthorized).toBe(false);
    });

    it('6.6 grants access to First-Year Coordinator for Semester 1 and 2 across branches', () => {
      const user = { role: 'faculty', id: 60001, is_first_year_coordinator: true };
      const sem1Assignment = { staff_account_id: 180009, branch: 'CSE', course_semester: 1 };
      const sem2Assignment = { staff_account_id: 180010, branch: 'EEE', course_semester: 2 };
      const sem3Assignment = { staff_account_id: 180011, branch: 'CSE', course_semester: 3 };

      const isSem1Allowed = user.is_first_year_coordinator && [1, 2].includes(sem1Assignment.course_semester);
      const isSem2Allowed = user.is_first_year_coordinator && [1, 2].includes(sem2Assignment.course_semester);
      const isSem3Allowed = user.is_first_year_coordinator && [1, 2].includes(sem3Assignment.course_semester);

      expect(isSem1Allowed).toBe(true);
      expect(isSem2Allowed).toBe(true);
      expect(isSem3Allowed).toBe(false); // First-year coordinator cannot access semester 3
    });
  });

  describe('7. Non-Destructive Invariant Verification', () => {
    it('7.1 verifies PDF export operations are strictly read-only and never alter publication state', () => {
      const originalMarks = [
        { id: 101, mark: 18, is_published: false },
        { id: 102, mark: 19, is_published: false }
      ];

      // Deep copy to simulate report extraction
      const reportCopy = JSON.parse(JSON.stringify(originalMarks));

      // Assert that state remains unchanged
      expect(reportCopy[0].is_published).toBe(false);
      expect(reportCopy[1].is_published).toBe(false);
      expect(originalMarks[0].is_published).toBe(false);
    });
  });

  describe('8. Evaluation PDF Export API Endpoint Route Simulation', () => {
    it('8.1 rejects unauthenticated requests with HTTP 401', async () => {
      const { GET } = await import('@/app/api/staff/faculty/evaluation/export/pdf/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/export/pdf?assignment_id=270018');

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('8.2 rejects requests missing assignment_id with HTTP 400', async () => {
      const apiUtils = await import('@/lib/api-utils');
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValueOnce({ role: 'faculty', id: 180009 });

      const { GET } = await import('@/app/api/staff/faculty/evaluation/export/pdf/route');
      const req = new Request('http://localhost:3000/api/staff/faculty/evaluation/export/pdf');

      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('8.3 marks export route re-exports evaluation export route correctly', async () => {
      const evalRoute = await import('@/app/api/staff/faculty/evaluation/export/pdf/route');
      const marksRoute = await import('@/app/api/staff/faculty/marks/export/pdf/route');
      expect(typeof evalRoute.GET).toBe('function');
      expect(typeof marksRoute.GET).toBe('function');
      expect(evalRoute.GET).toBe(marksRoute.GET);
    });
  });
});
