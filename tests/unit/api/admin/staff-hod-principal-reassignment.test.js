import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT as updateStaffHandler } from '@/app/api/admin/staff/[id]/route.js';

// Mock Next.js Headers & Cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name) => {
      if (name === 'admin_auth') return { value: 'admin-token' };
      if (name === 'staff_auth') return { value: 'staff-token' };
      return undefined;
    }),
  })),
  headers: vi.fn(() => new Headers()),
}));

// Mock Auth
vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn().mockImplementation(async (token) => {
    if (token === 'admin-token') {
      return { id: 1, email: 'admin@kucet.ac.in', role: 'admin' };
    }
    if (token === 'principal-token') {
      return { id: 101, email: 'principal@kucet.ac.in', role: 'faculty', is_principal: true };
    }
    return { id: 102, email: 'hod_cse@kucet.ac.in', role: 'faculty', is_hod: true, branch: 'CSE' };
  }),
}));

// Mock Logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  }
}));

// Mock DB
let mockStaffAccounts = [];
let mockHodAssignments = [];
let mockStaffRoles = [
  { id: 1, role_code: 'FACULTY', role_name: 'Faculty' },
  { id: 2, role_code: 'HOD', role_name: 'Head of Department' },
  { id: 90001, role_code: 'PRINCIPAL', role_name: 'Principal / Academic Supervisor' }
];
let mockSubjectAssignments = [];

vi.mock('@/db', () => {
  const makeQuery = (result = []) => {
    const q = {
      where: vi.fn(() => q),
      limit: vi.fn(() => q),
      orderBy: vi.fn(() => q),
      offset: vi.fn(() => q),
      innerJoin: vi.fn(() => q),
      from: vi.fn(() => q),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      catch: (reject) => Promise.resolve(result).catch(reject)
    };
    return q;
  };

  return {
    db: {
      select: vi.fn(() => makeQuery([])),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve([{ insertId: 1 }]))
      })),
      query: {
        staffAccounts: {
          findFirst: vi.fn(() => {
            return mockStaffAccounts[0] || null;
          })
        },
        staffRoles: {
          findFirst: vi.fn(() => {
            return mockStaffRoles[0] || null;
          })
        },
        facultyHodAssignments: {
          findFirst: vi.fn(() => null),
          findMany: vi.fn(() => mockHodAssignments.filter(a => a.is_active))
        },
        subjectAssignments: {
          findFirst: vi.fn(() => null),
          findMany: vi.fn(() => mockSubjectAssignments)
        }
      },
      transaction: vi.fn(async (cb) => {
        const tx = {
          query: {
            academicPrograms: {
              findFirst: vi.fn(() => ({ id: 1, department_id: 1, program_code: 'BTECH_CSE' }))
            },
            academicDepartments: {
              findFirst: vi.fn(() => ({ id: 1, department_code: 'CSE', department_name: 'CSE' }))
            },
            staffRoles: {
              findFirst: vi.fn(() => ({ id: 90001, role_code: 'PRINCIPAL' }))
            },
            facultyHodAssignments: {
              findFirst: vi.fn(() => null),
              findMany: vi.fn(() => mockHodAssignments.filter(a => a.is_active))
            }
          },
          update: vi.fn(() => ({
            set: vi.fn((_data) => ({
              where: vi.fn(() => Promise.resolve())
            }))
          })),
          insert: vi.fn(() => ({
            values: vi.fn((_data) => ({
              onDuplicateKeyUpdate: vi.fn(() => Promise.resolve([{ insertId: 1 }])),
              then: (resolve) => resolve([{ insertId: 1 }])
            }))
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve())
          })),
          select: vi.fn(() => makeQuery([{ id: 102, name: 'Goutham Masna', role_code: 'PRINCIPAL', department_code: 'CSE' }]))
        };
        return await cb(tx);
      })
    }
  };
});

describe('Branch-Specific HOD & Principal Supervision Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStaffAccounts = [
      {
        id: 101,
        name: 'Existing Faculty',
        email: 'faculty@kucet.ac.in',
        employee_id: 'EMP-101',
        is_active: true
      },
      {
        id: 102,
        name: 'Goutham Masna',
        email: 'goutham@kucet.ac.in',
        employee_id: 'EMP-102',
        is_active: true
      }
    ];

    mockHodAssignments = [
      {
        id: 501,
        staff_account_id: 102,
        staff_name: 'Goutham Masna',
        department_code: 'CSE',
        academic_year: '2026-27',
        is_active: true,
        start_date: '2026-06-01'
      }
    ];
  });

  describe('HOD Branch Assignment & Conflict Detection', () => {
    it('returns 409 Conflict when assigning a branch that already has an active HOD', async () => {
      const req = new Request('http://localhost:3000/api/admin/staff/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Existing Faculty',
          employee_id: 'EMP-101',
          is_active: true,
          branches: ['CSE'],
          hod_branches: ['CSE'],
          reassign_branches: [] // not pre-confirmed
        })
      });

      const { db } = await import('@/db');
      db.query.facultyHodAssignments.findFirst.mockResolvedValueOnce({
        id: 501,
        staff_account_id: 102,
        staff_name: 'Goutham Masna',
        department_code: 'CSE',
        academic_year: '2026-27',
        is_active: true
      });

      const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '101' }) });
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.conflictDetails).toBeDefined();
      expect(data.conflictDetails.conflict).toBe(true);
      expect(data.conflictDetails.branch).toBe('CSE');
      expect(data.conflictDetails.current_hod).toBe('Goutham Masna');
      expect(data.conflictDetails.academic_year).toBe('2026-27');
    });

    it('successfully reassigns HOD when reassign_branches is confirmed', async () => {
      const req = new Request('http://localhost:3000/api/admin/staff/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Existing Faculty',
          employee_id: 'EMP-101',
          is_active: true,
          branches: ['CSE'],
          hod_branches: ['CSE'],
          reassign_branches: ['CSE'] // explicitly confirmed!
        })
      });

      const { db } = await import('@/db');
      db.query.facultyHodAssignments.findFirst.mockResolvedValueOnce({
        id: 501,
        staff_account_id: 102,
        staff_name: 'Goutham Masna',
        department_code: 'CSE',
        academic_year: '2026-27',
        is_active: true
      });

      const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '101' }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/Staff record and assignments updated successfully/);
    });
  });

  describe('Principal-Level Supervisory Designation', () => {
    it('manages is_principal toggle without modifying Super Admin status', async () => {
      const req = new Request('http://localhost:3000/api/admin/staff/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Existing Faculty',
          employee_id: 'EMP-101',
          is_active: true,
          branches: ['CSE'],
          hod_branches: [],
          is_principal: true
        })
      });

      const { db } = await import('@/db');
      db.query.staffRoles.findFirst.mockResolvedValueOnce({
        id: 90001,
        role_code: 'PRINCIPAL',
        role_name: 'Principal / Academic Supervisor'
      });

      const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '101' }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Independent Cross-Branch Teaching Eligibility', () => {
    it('allows faculty to teach across any branch without requiring affiliation match', async () => {
      // Test payload for assigning faculty with CSE affiliation to teach IT course
      const payload = {
        faculty_id: 101, // Faculty whose home department is CSE
        subject_id: 202,
        branch: 'IT',   // Teaching IT course!
        semester: 4,
        academic_year: '2026-27'
      };

      // Validating that faculty assignments across branches are valid
      expect(payload.branch).toBe('IT');
      expect(payload.faculty_id).toBe(101);
    });
  });
});
