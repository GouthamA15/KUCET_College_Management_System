import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getAssignments, DELETE as deleteAssignment } from '@/app/api/staff/hod/subject-assignments/route';
import { GET as getAssignmentDetails } from '@/app/api/staff/hod/subject-assignments/[id]/route';
import { GET as getCoverage } from '@/app/api/staff/hod/academic-coverage/route';
import { GET as getReadiness } from '@/app/api/staff/hod/semester-readiness/route';
import { GET as getExport } from '@/app/api/staff/hod/subject-assignments/export/route';

let mockCurrentUser = null;
let mockDbAssignments = [];
let mockAuditLogs = [];

vi.mock('@/lib/academic-authorization', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    assertAcademicYearNotLocked: vi.fn(async () => {}),
    isAcademicYearLocked: vi.fn(async () => ({ isLocked: false }))
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn())
  }
}));

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
    }
  };
});

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((_table) => {
        const makeList = () => {
          const list = [...mockDbAssignments];
          list.orderBy = vi.fn(() => list);
          list.limit = vi.fn((lim) => {
            const sub = list.slice(0, lim || 1);
            sub.offset = vi.fn(() => sub);
            return sub;
          });
          list.offset = vi.fn(() => list);
          list.groupBy = vi.fn(() => list);
          return list;
        };
        const chain = {
          innerJoin: vi.fn(() => chain),
          leftJoin: vi.fn(() => chain),
          where: vi.fn(() => makeList()),
          orderBy: vi.fn(() => makeList()),
          groupBy: vi.fn(() => makeList()),
          limit: vi.fn((lim) => {
            const list = makeList().slice(0, lim || 1);
            list.offset = vi.fn(() => list);
            return list;
          }),
          offset: vi.fn(() => makeList())
        };
        return chain;
      })
    })),
    insert: vi.fn(() => ({
      values: vi.fn((vals) => {
        mockAuditLogs.push(vals);
        return [{ insertId: 999 }];
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => [{ affectedRows: 1 }])
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => [{ affectedRows: 1 }])
    }))
  }
}));

describe('Teaching Assignment Directory & Academic Coverage Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogs = [];
    mockDbAssignments = [
      {
        id: 1,
        faculty_id: 101,
        subject_code: 'CS101',
        subject_name: 'Programming for Problem Solving',
        course_semester: 1,
        academic_term: 1,
        academic_year: '2025-26',
        branch: 'CSE',
        faculty_name: 'Dr. Alan Turing',
        employee_id: 'FAC101',
        faculty_email: 'alan@kucet.ac.in',
        faculty_designation: 'Professor',
        is_active: true,
        subject_type: 'theory',
        created_at: new Date('2025-08-01')
      },
      {
        id: 2,
        faculty_id: 102,
        subject_code: 'CS102',
        subject_name: 'Data Structures Lab',
        course_semester: 2,
        academic_term: 2,
        academic_year: '2025-26',
        branch: 'CSE',
        faculty_name: 'Dr. Ada Lovelace',
        employee_id: 'FAC102',
        faculty_email: 'ada@kucet.ac.in',
        faculty_designation: 'Associate Professor',
        is_active: true,
        subject_type: 'lab',
        created_at: new Date('2025-08-01')
      },
      {
        id: 3,
        faculty_id: 103,
        subject_code: 'CS301',
        subject_name: 'Database Management Systems',
        course_semester: 3,
        academic_term: 1,
        academic_year: '2025-26',
        branch: 'CSE',
        faculty_name: 'Dr. Edgar Codd',
        employee_id: 'FAC103',
        faculty_email: 'codd@kucet.ac.in',
        faculty_designation: 'Professor',
        is_active: true,
        subject_type: 'theory',
        created_at: new Date('2025-08-01')
      },
      {
        id: 4,
        faculty_id: 101,
        subject_code: 'CS101',
        subject_name: 'Programming for Problem Solving',
        course_semester: 1,
        academic_term: 1,
        academic_year: '2024-25',
        branch: 'CSE',
        faculty_name: 'Dr. Alan Turing',
        employee_id: 'FAC101',
        faculty_email: 'alan@kucet.ac.in',
        faculty_designation: 'Professor',
        is_active: false,
        subject_type: 'theory',
        created_at: new Date('2024-08-01')
      }
    ];
  });

  describe('1. HOD Role and Branch Scoping', () => {
    it('authorizes HOD to query assignments for their authorized branch across Semesters 1-8', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        hod_department_code: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments?branch=CSE&semester=3');
      const res = await getAssignments(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });

    it('strictly denies HOD from accessing academic records of unauthorized departments', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        hod_department_code: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments?branch=ECE&semester=3');
      const res = await getAssignments(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toMatch(/Forbidden|Not authorized/);
    });
  });

  describe('2. First-Year Coordinator Role and Scope Enforcement', () => {
    it('authorizes First-Year Coordinator for Semesters 1 and 2 across any canonical branch', async () => {
      mockCurrentUser = {
        id: 20,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      for (const branch of ['CSE', 'ECE', 'EEE', 'IT', 'MECH', 'CIVIL', 'CSD']) {
        const reqSem1 = new Request(`http://localhost:3000/api/staff/hod/subject-assignments?branch=${branch}&semester=1`);
        const resSem1 = await getAssignments(reqSem1);
        expect(resSem1.status).toBe(200);

        const reqSem2 = new Request(`http://localhost:3000/api/staff/hod/subject-assignments?branch=${branch}&semester=2`);
        const resSem2 = await getAssignments(reqSem2);
        expect(resSem2.status).toBe(200);
      }
    });

    it('strictly denies First-Year Coordinator from querying upper semesters (Sem 3-8)', async () => {
      mockCurrentUser = {
        id: 20,
        role: 'faculty',
        is_first_year_coordinator: true,
        branch: 'CSE'
      };

      for (let sem = 3; sem <= 8; sem++) {
        const req = new Request(`http://localhost:3000/api/staff/hod/subject-assignments?branch=CSE&semester=${sem}`);
        const res = await getAssignments(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error).toMatch(/Forbidden/);
      }
    });
  });

  describe('3. Teaching Assignment Lifecycle & Deactivation Audit', () => {
    it('writes auditable event to auditLogs upon assignment deletion or deactivation', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments?id=1', {
        method: 'DELETE'
      });

      const res = await deleteAssignment(req);
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAuditLogs.length).toBeGreaterThan(0);
      expect(mockAuditLogs[0].target_type).toBe('faculty_subject_assignments');
      expect(mockAuditLogs[0].action).toMatch(/DEACTIVATE|DELETE/);
    });

    it('fetches complete assignment details and audit history via [id] route', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments/1');
      const res = await getAssignmentDetails(req, { params: Promise.resolve({ id: '1' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(json.data.subject_code).toBe('CS101');
      expect(json.data.faculty_name).toBe('Dr. Alan Turing');
      expect(json.data.status).toBe('ACTIVE');
    });

    it('denies [id] lookup if the assignment belongs to an unauthorized department', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'ECE',
        authorized_branches: ['ECE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments/1');
      const res = await getAssignmentDetails(req, { params: Promise.resolve({ id: '1' }) });
      const _json = await res.json();

      expect(res.status).toBe(403);
    });

    it('supports live search filter matching faculty name or subject title', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments?branch=CSE&search=turing');
      const res = await getAssignments(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.every(a => a.faculty_name.toLowerCase().includes('turing') || a.subject_name.toLowerCase().includes('turing'))).toBe(true);
    });
  });

  describe('4. Academic Coverage Intelligence Endpoint', () => {
    it('returns coverage summary and actionable alerts for authorized scope', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/academic-coverage?branch=CSE&semester=1');
      const res = await getCoverage(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(json.data.summary).toBeDefined();
      expect(json.data.covered_subjects).toBeDefined();
      expect(json.data.unassigned_subjects).toBeDefined();
      expect(json.data.workload_distribution).toBeDefined();
    });

    it('denies coverage query when outside authorized department', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/academic-coverage?branch=MECH&semester=3');
      const res = await getCoverage(req);
      const _json = await res.json();

      expect(res.status).toBe(403);
    });
  });

  describe('5. Semester Readiness Checklist Endpoint', () => {
    it('evaluates curriculum, allocation, timetable and requests readiness', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/semester-readiness?branch=CSE&semester=1');
      const res = await getReadiness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.readiness_score).toBeDefined();
      expect(Array.isArray(json.data.checklist)).toBe(true);
      expect(json.data.checklist.some(c => c.id === 'syllabus')).toBe(true);
      expect(json.data.checklist.some(c => c.id === 'allocations')).toBe(true);
      expect(json.data.checklist.some(c => c.id === 'timetable')).toBe(true);
    });
  });

  describe('6. CSV Export Endpoint Security & Formatting', () => {
    it('enforces branch authorization on export generation', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments/export?branch=CIVIL&semester=4');
      const res = await getExport(req);
      const _json = await res.json();

      expect(res.status).toBe(403);
    });

    it('generates valid RFC-compliant CSV headers for authorized export', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments/export?branch=CSE&semester=1');
      const res = await getExport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename=');
      const text = await res.text();
      expect(text).toContain('Subject Code');
      expect(text).toContain('Faculty Name');
    });

    it('neutralizes spreadsheet formula injection payloads (=, +, -, @, \\t)', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      // Add dangerous formula subject name
      mockDbAssignments.push({
        id: 99,
        faculty_id: 101,
        subject_code: '=cmd|/C calc',
        subject_name: '+@Sum(A1:A10)',
        course_semester: 1,
        academic_term: 1,
        academic_year: '2025-26',
        branch: 'CSE',
        faculty_name: '-Dr. Malicious',
        employee_id: '@FAC99',
        is_active: true,
        created_at: new Date()
      });

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments/export?branch=CSE&semester=1');
      const res = await getExport(req);
      const text = await res.text();

      // Ensure formula prefixes are prepended with a neutralizing single quote
      expect(text).toContain("\"'=cmd|/C calc\"");
      expect(text).toContain("\"'+@Sum(A1:A10)\"");
      expect(text).toContain("\"'-Dr. Malicious\"");
      expect(text).toContain("\"'@FAC99\"");
    });
  });

  describe('7. Server-Side Pagination & Performance Metadata', () => {
    it('returns pagination metadata when page and limit are specified', async () => {
      mockCurrentUser = {
        id: 10,
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
        authorized_branches: ['CSE']
      };

      const req = new Request('http://localhost:3000/api/staff/hod/subject-assignments?branch=CSE&page=1&limit=2');
      const res = await getAssignments(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.meta.pagination).toBeDefined();
      expect(json.meta.pagination.page).toBe(1);
      expect(json.meta.pagination.limit).toBe(2);
    });
  });
});
