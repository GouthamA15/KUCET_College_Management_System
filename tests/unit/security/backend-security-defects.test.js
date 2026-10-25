import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks for Next.js and System Libraries ---
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => new Headers()),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  getCollegeAcademicYear: vi.fn().mockResolvedValue('2025-26'),
  getCurrentCalendarSession: vi.fn().mockResolvedValue({
    academicYear: '2025-26',
    activeSemester: 1,
  }),
}));

vi.mock('@/services/StudentService', () => ({
  StudentService: {
    getFullStudentDataForExport: vi.fn().mockResolvedValue([
      {
        roll_no: '24567T0901',
        name: 'Test Student',
        aadhaar_no: '123456789012',
      }
    ]),
  },
}));

// --- Test Suites ---

describe('Phase 3 Security Defect Hardening Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // DEFECT 1: Missing Role Authorization on /api/staff/admission/export-students
  // =========================================================================
  describe('Defect 1: Student Master Export Role Authorization Hardening', () => {
    let exportRoute;
    let mockAuthUser;

    beforeEach(async () => {
      vi.doMock('@/lib/api-utils', async (importOriginal) => {
        const actual = await importOriginal();
        return {
          ...actual,
          getAuthUser: vi.fn(() => mockAuthUser),
        };
      });

      const routeModule = await import('@/app/api/staff/admission/export-students/route.js');
      exportRoute = routeModule.GET;
    });

    const createRequest = () => {
      return new Request('http://localhost:3000/api/staff/admission/export-students?branch=09&year=1&format=json');
    };

    it('DENIES access (403) for standard Faculty role', async () => {
      mockAuthUser = { id: 101, role: 'faculty', email: 'faculty@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden: Access denied/i);
    });

    it('DENIES access (403) for HOD role', async () => {
      mockAuthUser = { id: 102, role: 'faculty', is_hod: true, branch: 'CSE', email: 'hod@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden: Access denied/i);
    });

    it('DENIES access (403) for First Year Coordinator role', async () => {
      mockAuthUser = { id: 103, role: 'faculty', is_first_year_coordinator: true, email: 'coord@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden: Access denied/i);
    });

    it('DENIES access (403) for Scholarship Clerk role', async () => {
      mockAuthUser = { id: 104, role: 'scholarship', email: 'scholarship@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden: Access denied/i);
    });

    it('DENIES access (401) for unauthenticated requests', async () => {
      mockAuthUser = null;
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(401);
    });

    it('ALLOWS access (200) for Admission Clerk role', async () => {
      mockAuthUser = { id: 105, role: 'admission', email: 'admission@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.students).toBeDefined();
    });

    it('ALLOWS access (200) for Super Admin role', async () => {
      mockAuthUser = { id: 1, role: 'admin', email: 'admin@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.students).toBeDefined();
    });

    it('ALLOWS access (200) for Principal role', async () => {
      mockAuthUser = { id: 99, role: 'principal', email: 'principal@kucet.ac.in' };
      const res = await exportRoute(createRequest());
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // DEFECT 2: Dynamic HOD Assignment Resolution (FacultyService.getHodBranches)
  // =========================================================================
  describe('Defect 2: Dynamic HOD Assignment Resolution via facultyHodAssignments', () => {
    let FacultyService;
    let mockActiveAssignments = [];
    let mockAnyAssignments = [];
    let mockAffil = [];

    beforeEach(async () => {
      vi.resetModules();
      mockActiveAssignments = [];
      mockAnyAssignments = [];
      mockAffil = [];

      vi.doMock('@/db', () => ({
        db: {
          select: vi.fn((fields) => ({
            from: vi.fn((_table) => ({
              where: vi.fn(() => {
                // If selecting from facultyHodAssignments
                if (fields?.dept_code) {
                  return Promise.resolve(mockActiveAssignments);
                }
                if (fields?.id) {
                  return {
                    limit: vi.fn(() => Promise.resolve(mockAnyAssignments))
                  };
                }
                return {
                  innerJoin: vi.fn(() => ({
                    leftJoin: vi.fn(() => ({
                      where: vi.fn(() => Promise.resolve(mockAffil))
                    }))
                  }))
                };
              }),
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => Promise.resolve(mockAffil))
                }))
              }))
            }))
          }))
        }
      }));

      const serviceModule = await import('@/services/academic/FacultyService');
      FacultyService = serviceModule.FacultyService;
    });

    it('returns active branches from facultyHodAssignments when assignment is valid', async () => {
      mockActiveAssignments = [{ dept_code: 'CSE' }, { dept_code: 'CSD' }];
      mockAnyAssignments = [{ id: 1 }];

      const branches = await FacultyService.getHodBranches(101, 'faculty');
      expect(branches).toEqual(['CSE', 'CSD']);
    });

    it('returns empty array [] when faculty member was deactivated in facultyHodAssignments (does NOT fall back to legacy flag)', async () => {
      // Inactive: no active rows, but a record exists in facultyHodAssignments
      mockActiveAssignments = [];
      mockAnyAssignments = [{ id: 1 }]; // Deactivated/ended assignment exists
      // Even if legacy staffAcademicAffiliations has is_hod = true
      mockAffil = [{ dept_code: 'CSE', is_hod: true }];

      const branches = await FacultyService.getHodBranches(101, 'faculty');
      expect(branches).toEqual([]);
    });

    it('returns empty array [] when faculty member has no HOD assignments at all', async () => {
      mockActiveAssignments = [];
      mockAnyAssignments = [];
      mockAffil = [];

      const branches = await FacultyService.getHodBranches(101, 'faculty');
      expect(branches).toEqual([]);
    });

    it('falls back to staffAcademicAffiliations ONLY when zero facultyHodAssignments exist and is_hod is true', async () => {
      mockActiveAssignments = [];
      mockAnyAssignments = []; // No records in dynamic table
      mockAffil = [{ dept_code: 'ECE', prog_code: null, is_hod: true }];

      const branches = await FacultyService.getHodBranches(102, 'faculty');
      expect(branches).toEqual(['ECE']);
    });

    it('returns empty array when staffId is null/undefined', async () => {
      const branches = await FacultyService.getHodBranches(null);
      expect(branches).toEqual([]);
    });
  });

  // =========================================================================
  // DEFECT 3: Reactivations Fail-Closed Security (/api/staff/hod/reactivations)
  // =========================================================================
  describe('Defect 3: Reactivations Endpoint Fail-Closed Isolation', () => {
    let reactivationsRoute;
    let mockAuthUser;
    let mockReactivationRows = [];

    beforeEach(async () => {
      vi.resetModules();
      mockReactivationRows = [
        { id: 1, roll_no: '21567T0901', reason: 'Medical' }, // CSE (09)
        { id: 2, roll_no: '21567T1502', reason: 'Family' },  // ECE (15)
        { id: 3, roll_no: '21567T1803', reason: 'Personal' } // IT (18)
      ];

      vi.doMock('@/lib/api-utils', async (importOriginal) => {
        const actual = await importOriginal();
        return {
          ...actual,
          getAuthUser: vi.fn(() => mockAuthUser),
        };
      });

      vi.doMock('@/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => Promise.resolve(mockReactivationRows))
                }))
              }))
            }))
          }))
        }
      }));

      const routeModule = await import('@/app/api/staff/hod/reactivations/route');
      reactivationsRoute = routeModule.GET;
    });

    const createRequest = () => {
      return new Request('http://localhost:3000/api/staff/hod/reactivations?status=PENDING_HOD');
    };

    it('FAILS CLOSED: returns empty data array when HOD has empty authorized_branches and no branch', async () => {
      mockAuthUser = {
        id: 101,
        role: 'faculty',
        is_hod: true,
        authorized_branches: [],
        branch: null
      };

      const res = await reactivationsRoute(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]); // Must NOT return all rows!
    });

    it('FILTERS strictly to authorized branch for HOD', async () => {
      mockAuthUser = {
        id: 101,
        role: 'faculty',
        is_hod: true,
        authorized_branches: ['CSE'],
        branch: 'CSE'
      };

      const res = await reactivationsRoute(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].roll_no).toBe('21567T0901');
    });

    it('ALLOWS Admin to view all branches unfiltered', async () => {
      mockAuthUser = {
        id: 1,
        role: 'admin',
        authorized_branches: []
      };

      const res = await reactivationsRoute(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(3);
    });

    it('DENIES access (401) for non-HOD faculty', async () => {
      mockAuthUser = {
        id: 102,
        role: 'faculty',
        is_hod: false
      };

      const res = await reactivationsRoute(createRequest());
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // DEFECT 4: First Year Coordinator Cross-Branch Access in Class Lookup
  // =========================================================================
  describe('Defect 4: First Year Coordinator Class Lookup Authorization', () => {
    let classLookupRoute;
    let mockAuthUser;
    let mockStudentRows = [];

    beforeEach(async () => {
      vi.resetModules();
      mockStudentRows = [
        { id: 1, roll_no: '25567T1501', name: 'ECE Year 1 Student', student_status: 'ACTIVE' },
        { id: 2, roll_no: '25567T0902', name: 'CSE Year 1 Student', student_status: 'ACTIVE' },
      ];

      vi.doMock('@/lib/api-utils', async (importOriginal) => {
        const actual = await importOriginal();
        return {
          ...actual,
          getAuthUser: vi.fn(() => mockAuthUser),
        };
      });

      vi.doMock('@/db', () => {
        const createQueryChain = (data = []) => {
          const q = {
            from: vi.fn(() => q),
            innerJoin: vi.fn(() => q),
            leftJoin: vi.fn(() => q),
            where: vi.fn(() => q),
            orderBy: vi.fn(() => q),
            limit: vi.fn(() => q),
            then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
            catch: (reject) => Promise.resolve(data).catch(reject)
          };
          return q;
        };

        return {
          db: {
            select: vi.fn((fields) => {
              // If selecting affiliation
              if (fields && (fields.dept_code || fields.prog_code)) {
                return createQueryChain([{ dept_code: 'CSE', prog_code: 'BTECH_CSE' }]);
              }
              // If selecting students
              return createQueryChain(mockStudentRows);
            })
          }
        };
      });

      const routeModule = await import('@/app/api/staff/faculty/class-lookup/route');
      classLookupRoute = routeModule.GET;
    });

    it('ALLOWS First Year Coordinator to view Year 1 students in another branch (e.g. ECE)', async () => {
      mockAuthUser = {
        id: 201,
        role: 'faculty',
        branch: 'CSE',
        is_first_year_coordinator: true,
      };

      const req = new Request('http://localhost:3000/api/staff/faculty/class-lookup?program=ECE&yearOfStudy=1');
      const res = await classLookupRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
    });

    it('DENIES First Year Coordinator (403) for Year 2 in another branch (outside assigned department)', async () => {
      mockAuthUser = {
        id: 201,
        role: 'faculty',
        branch: 'CSE',
        is_first_year_coordinator: true,
      };

      const req = new Request('http://localhost:3000/api/staff/faculty/class-lookup?program=ECE&yearOfStudy=2');
      const res = await classLookupRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/not authorized/i);
    });

    it('ALLOWS standard Faculty to view students in their own assigned department', async () => {
      mockAuthUser = {
        id: 202,
        role: 'faculty',
        branch: 'CSE',
        is_first_year_coordinator: false,
      };

      const req = new Request('http://localhost:3000/api/staff/faculty/class-lookup?program=CSE&yearOfStudy=2');
      const res = await classLookupRoute(req);
      expect(res.status).toBe(200);
    });

    it('DENIES standard Faculty (403) from accessing another department', async () => {
      mockAuthUser = {
        id: 202,
        role: 'faculty',
        branch: 'CSE',
        is_first_year_coordinator: false,
      };

      const req = new Request('http://localhost:3000/api/staff/faculty/class-lookup?program=ECE&yearOfStudy=2');
      const res = await classLookupRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/not authorized/i);
    });
  });
});
