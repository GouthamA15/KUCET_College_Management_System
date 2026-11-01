import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '@/app/api/admin/staff/[id]/route.js';

// Mock Next.js Headers & Cookies
let mockAdminToken = 'admin-token';
let mockStaffToken = null;
let mockRequestHeaders = new Headers();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name) => {
      if (name === 'admin_auth' && mockAdminToken) return { value: mockAdminToken };
      if (name === 'staff_auth' && mockStaffToken) return { value: mockStaffToken };
      return undefined;
    }),
  })),
  headers: vi.fn(() => mockRequestHeaders),
}));

// Mock Auth
vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn().mockImplementation(async (token) => {
    if (token === 'admin-token') {
      return { id: 1, email: 'principal@kucet.edu', role: 'admin' };
    }
    if (token === 'staff-token') {
      return { id: 180010, email: 'faculty@kucet.ac.in', role: 'faculty' };
    }
    return null;
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
  },
}));

// Mock DB State
let mockStaffAccounts = [];
let mockStaffRoles = [
  { id: 1, role_code: 'FACULTY', role_name: 'Faculty' },
  { id: 2, role_code: 'HOD', role_name: 'Head of Department' },
  { id: 90001, role_code: 'PRINCIPAL', role_name: 'Principal / Academic Supervisor' }
];
let mockStaffAccountRoles = [];
let mockStaffAffiliations = [];
let mockHodAssignments = [];
let mockAcademicDepts = [
  { id: 1, department_code: 'CSE', department_name: 'Computer Science & Engineering' },
  { id: 2, department_code: 'ECE', department_name: 'Electronics & Communication Engineering' },
  { id: 3, department_code: 'EEE', department_name: 'Electrical & Electronics Engineering' },
  { id: 4, department_code: 'CSD', department_name: 'Computer Science & Data Science' },
  { id: 5, department_code: 'IT', department_name: 'Information Technology' },
  { id: 6, department_code: 'CIVIL', department_name: 'Civil Engineering' },
  { id: 7, department_code: 'MECH', department_name: 'Mechanical Engineering' },
];

vi.mock('@/db', () => {
  const makeQuery = (result = []) => {
    const q = {
      where: vi.fn(() => q),
      limit: vi.fn(() => q),
      orderBy: vi.fn(() => q),
      offset: vi.fn(() => q),
      innerJoin: vi.fn(() => q),
      leftJoin: vi.fn(() => q),
      from: vi.fn(() => q),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      catch: (reject) => Promise.resolve(result).catch(reject),
    };
    return q;
  };

  return {
    db: {
      select: vi.fn((fields) => {
        // Return different mocks based on fields query
        if (fields && fields.role_code) {
          return makeQuery(mockStaffAccountRoles);
        }
        if (fields && fields.branch) {
          return makeQuery(mockStaffAffiliations);
        }
        if (fields && fields.dept) {
          return makeQuery(mockHodAssignments);
        }
        return makeQuery([]);
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve([{ insertId: 1 }])),
      })),
      query: {
        staffAccounts: {
          findFirst: vi.fn((_opts) => {
            const found = mockStaffAccounts.find(s => s.id === 180010 || s.id === 101);
            return Promise.resolve(found || null);
          }),
        },
        staffRoles: {
          findFirst: vi.fn(() => Promise.resolve(mockStaffRoles[0])),
        },
        facultyHodAssignments: {
          findFirst: vi.fn(() => Promise.resolve(null)),
          findMany: vi.fn(() => Promise.resolve(mockHodAssignments)),
        },
        academicDepartments: {
          findFirst: vi.fn((_opts) => Promise.resolve(mockAcademicDepts[0])),
        },
        academicPrograms: {
          findFirst: vi.fn(() => Promise.resolve(null)),
        },
      },
      transaction: vi.fn(async (cb) => {
        const tx = {
          query: {
            academicDepartments: {
              findFirst: vi.fn(() => Promise.resolve(mockAcademicDepts[0])),
            },
            academicPrograms: {
              findFirst: vi.fn(() => Promise.resolve(null)),
            },
            staffRoles: {
              findFirst: vi.fn(() => Promise.resolve(mockStaffRoles[0])),
            },
            facultyHodAssignments: {
              findFirst: vi.fn(() => Promise.resolve(null)),
            },
          },
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }])),
            })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve([{ insertId: 1 }])),
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
          select: vi.fn(() => makeQuery([])),
          execute: vi.fn(() => Promise.resolve([])),
        };
        return await cb(tx);
      }),
    },
  };
});

describe('P1 Faculty Branch Allocation & Staff Details Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminToken = 'admin-token';
    mockStaffToken = null;
    mockRequestHeaders = new Headers();
    mockStaffAccounts = [
      {
        id: 180010,
        name: 'Dr. Goutham Masna',
        email: 'goutham.masna@kucet.ac.in',
        employee_id: 'KU-FAC-180010',
        staff_category: 'FACULTY',
        designation: 'Assistant Professor',
        account_status: 'ACTIVE',
        created_at: new Date('2026-08-01T00:00:00Z'),
        updated_at: new Date('2026-08-01T00:00:00Z'),
      },
    ];
    mockStaffAccountRoles = [
      { role_code: 'FACULTY' },
    ];
    mockStaffAffiliations = [
      { branch: 'CSE' },
    ];
    mockHodAssignments = [];
  });

  it('1. Authorized administrator can retrieve an existing staff record via GET', async () => {
    const req = new Request('https://kucet.tech/api/admin/staff/180010');
    const res = await GET(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe(180010);
    expect(data.data.name).toBe('Dr. Goutham Masna');
    expect(data.data.employee_id).toBe('KU-FAC-180010');
    expect(data.data.branches).toContain('CSE');
    expect(data.data.roles).toContain('faculty');
  });

  it('2. Authorized administrator can change the branch allocation via PUT', async () => {
    const req = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branches: ['CSE', 'CSD'],
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.branches).toEqual(['CSE', 'CSD']);
  });

  it('3. The update is persisted and returned correctly with preserved fields', async () => {
    const req = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branches: ['ECE'],
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.id).toBe(180010);
    expect(json.data.name).toBe('Dr. Goutham Masna');
    expect(json.data.email).toBe('goutham.masna@kucet.ac.in');
    expect(json.data.branches).toEqual(['ECE']);
  });

  it('4. Invalid staff ID (NaN, 0, or negative) is rejected with 400 Bad Request', async () => {
    const reqGet = new Request('https://kucet.tech/api/admin/staff/invalid-id');
    const resGet = await GET(reqGet, { params: Promise.resolve({ id: 'invalid-id' }) });
    expect(resGet.status).toBe(400);

    const jsonGet = await resGet.json();
    expect(jsonGet.error).toBe('Invalid staff ID');

    const reqPut = new Request('https://kucet.tech/api/admin/staff/0', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branches: ['CSE'] }),
    });
    const resPut = await PUT(reqPut, { params: Promise.resolve({ id: '0' }) });
    expect(resPut.status).toBe(400);
  });

  it('5. Nonexistent staff ID returns 404 Not Found', async () => {
    mockStaffAccounts = []; // Empty DB

    const req = new Request('https://kucet.tech/api/admin/staff/999999');
    const res = await GET(req, { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Staff not found');
  });

  it('6. Invalid or nonexistent branch ID is rejected with 400 Bad Request', async () => {
    const req = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branches: ['INVALID_BRANCH_XYZ'],
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Invalid branch');
  });

  it('7. Unauthorized users (non-admin or unauthenticated) cannot access or modify branch allocation', async () => {
    mockAdminToken = null; // No admin cookie

    const reqGet = new Request('https://kucet.tech/api/admin/staff/180010');
    const resGet = await GET(reqGet, { params: Promise.resolve({ id: '180010' }) });
    expect(resGet.status).toBe(401);

    const reqPut = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branches: ['CSE'] }),
    });
    const resPut = await PUT(reqPut, { params: Promise.resolve({ id: '180010' }) });
    expect(resPut.status).toBe(401);
  });

  it('8. Missing or malformed JSON body is handled safely', async () => {
    const req = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{{{',
    });

    const res = await PUT(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(500); // Caught safely without crashing process
  });

  it('9. Handles Cloudflare multi-IP x-forwarded-for header safely without DB overflow', async () => {
    mockRequestHeaders.set('x-forwarded-for', '2409:40f0:1234:5678:9abc:def0:1234:5678, 172.70.130.40, 108.162.245.10');

    const req = new Request('https://kucet.tech/api/admin/staff/180010', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '2409:40f0:1234:5678:9abc:def0:1234:5678, 172.70.130.40, 108.162.245.10',
      },
      body: JSON.stringify({
        branches: ['CSE', 'IT'],
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: '180010' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
