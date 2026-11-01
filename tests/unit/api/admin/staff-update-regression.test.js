import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT as updateStaffHandler } from '@/app/api/admin/staff/[id]/route.js';

let mockCurrentUser = { id: 1, email: 'admin@kucet.ac.in', role: 'admin' };
let mockStaffAccount = null;
let mockStaffRoles = [
  { id: 1, role_code: 'FACULTY', role_name: 'Faculty' },
  { id: 2, role_code: 'HOD', role_name: 'Head of Department' },
  { id: 3, role_code: 'ADMISSION_STAFF', role_name: 'Admission Staff' }
];
let mockExecutedSql = [];

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: 'admin-token' }))
  })),
  headers: vi.fn(() => new Headers())
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(async () => mockCurrentUser)
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb())
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb())
  }
}));

vi.mock('@/lib/academic-utils', () => ({
  getCurrentCalendarSession: vi.fn(async () => ({ academicYear: '2026-27', semester: 1 }))
}));

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
          findFirst: vi.fn(async () => mockStaffAccount)
        },
        staffRoles: {
          findFirst: vi.fn(async () => mockStaffRoles[0])
        },
        facultyHodAssignments: {
          findFirst: vi.fn(async () => null)
        }
      },
      transaction: vi.fn(async (cb) => {
        const tx = {
          execute: vi.fn(async (statement) => {
            mockExecutedSql.push(statement);
            return [{ affectedRows: 1 }];
          }),
          select: vi.fn(() => makeQuery([])),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }]))
            }))
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve([{ insertId: 1 }]))
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }]))
          })),
          query: {
            academicPrograms: { findFirst: vi.fn(async () => null) },
            academicDepartments: { findFirst: vi.fn(async () => null) },
            staffRoles: { findFirst: vi.fn(async () => mockStaffRoles[0]) },
            facultyHodAssignments: { findFirst: vi.fn(async () => null) }
          }
        };
        return await cb(tx);
      })
    }
  };
});

describe('Staff Update Route — Regression & Incident Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: 1, email: 'admin@kucet.ac.in', role: 'admin' };
    mockExecutedSql = [];
    mockStaffAccount = {
      id: 180010,
      name: 'Test Faculty',
      email: 'faculty@kucet.ac.in',
      employee_id: 'EMP-180010',
      account_status: 'ACTIVE',
      staff_category: 'TEACHING'
    };
  });

  it('rejects coordinator assignment if faculty role is not assigned with HTTP 400', async () => {
    const req = new Request('http://localhost/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        is_first_year_coordinator: true
      })
    });

    const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Only active faculty members are eligible for First Year Coordinator assignment/);
  });

  it('rejects coordinator end date earlier than start date with HTTP 400', async () => {
    const { db } = await import('@/db');
    db.transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        execute: vi.fn(async () => [{ affectedRows: 1 }]),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ role_code: 'FACULTY' }])
            }))
          }))
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })) })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })),
        query: {
          academicPrograms: { findFirst: vi.fn(async () => null) },
          academicDepartments: { findFirst: vi.fn(async () => null) }
        }
      };
      return await cb(tx);
    });

    const req = new Request('http://localhost/api/admin/staff/180010', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.195, 172.70.134.12, 108.162.245.89' // Multi-IP proxy chain
      },
      body: JSON.stringify({
        is_first_year_coordinator: true,
        coordinator_start_date: '2026-11-01',
        coordinator_end_date: '2026-10-01'
      })
    });

    const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/End date cannot be earlier than start date/);
  });

  it('rejects shifting faculty to non-teaching role with HTTP 400', async () => {
    const { db } = await import('@/db');
    // Mock current roles to contain FACULTY
    db.transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ role_code: 'FACULTY' }])
            }))
          }))
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })) })),
        execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })),
        query: {
          academicPrograms: { findFirst: vi.fn(async () => null) },
          academicDepartments: { findFirst: vi.fn(async () => null) }
        }
      };
      return await cb(tx);
    });

    const req = new Request('http://localhost/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roles: ['admission']
      })
    });

    const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Teaching roles \(faculty\) cannot be shifted to non-teaching roles/);
  });

  it('revokes active sessions and tokens when staff account is deactivated (is_active: false)', async () => {
    const req = new Request('http://localhost/api/admin/staff/180010', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.42, 172.68.10.1'
      },
      body: JSON.stringify({
        is_active: false
      })
    });

    const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.is_active).toBe(false);

    // Verify session revocation queries were executed
    expect(mockExecutedSql.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 401 when unauthenticated request attempts to update staff', async () => {
    mockCurrentUser = null;
    const req = new Request('http://localhost/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' })
    });

    const res = await updateStaffHandler(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(401);
  });
});
