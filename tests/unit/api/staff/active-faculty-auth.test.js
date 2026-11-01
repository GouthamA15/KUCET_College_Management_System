import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getActiveFaculty } from '@/app/api/staff/hod/active-faculty/route.js';

let mockCurrentUser = null;

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name) => {
      if (name === 'staff_auth' || name === 'admin_auth') {
        return { value: 'valid-test-token' };
      }
      return undefined;
    })
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

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([
                  { staff_id: 101 },
                  { staff_id: 102 }
                ])
              }))
            }))
          }))
        })),
        where: vi.fn().mockResolvedValue([
          {
            id: 101,
            employee_id: 'EMP-101',
            name: 'Dr. First Faculty',
            email: 'first@kucet.ac.in',
            designation: 'Assistant Professor',
            account_status: 'ACTIVE'
          }
        ])
      }))
    }))
  }
}));

describe('Active Faculty API Authorization & Scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows First Year Coordinator to fetch active faculty for any institutional branch', async () => {
    mockCurrentUser = {
      id: 50,
      role: 'faculty',
      is_first_year_coordinator: true,
      email: 'coord@kucet.ac.in'
    };

    const req = new Request('http://localhost/api/staff/hod/active-faculty?branch=CSE');
    const res = await getActiveFaculty(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].department_code).toBe('CSE');
  });

  it('allows HOD to fetch active faculty for their authorized branch', async () => {
    mockCurrentUser = {
      id: 60,
      role: 'faculty',
      is_hod: true,
      authorized_branches: ['CSE', 'CSD'],
      email: 'hod_cse@kucet.ac.in'
    };

    const req = new Request('http://localhost/api/staff/hod/active-faculty?branch=CSE');
    const res = await getActiveFaculty(req);
    expect(res.status).toBe(200);
  });

  it('blocks HOD with 403 when requesting an unauthorized branch', async () => {
    mockCurrentUser = {
      id: 60,
      role: 'faculty',
      is_hod: true,
      authorized_branches: ['CSE'],
      email: 'hod_cse@kucet.ac.in'
    };

    const req = new Request('http://localhost/api/staff/hod/active-faculty?branch=ECE');
    const res = await getActiveFaculty(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden - Not authorized for ECE department/);
  });

  it('blocks regular faculty without HOD or Coordinator role with 403', async () => {
    mockCurrentUser = {
      id: 70,
      role: 'faculty',
      is_hod: false,
      is_first_year_coordinator: false,
      email: 'faculty@kucet.ac.in'
    };

    const req = new Request('http://localhost/api/staff/hod/active-faculty?branch=CSE');
    const res = await getActiveFaculty(req);
    expect(res.status).toBe(403);
  });
});
