import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authLib from '@/lib/auth';
import { GET as listStaffRequests } from '@/app/api/admin/staff-requests/route.js';
import { POST as approveStaffRequest } from '@/app/api/admin/staff-requests/[id]/approve/route.js';
import { POST as rejectStaffRequest } from '@/app/api/admin/staff-requests/[id]/reject/route.js';
import { POST as resendActivationRequest } from '@/app/api/admin/staff-requests/[id]/resend-activation/route.js';
import { GET as listHodRequests } from '@/app/api/admin/hod-requests/route.js';
import {
  staffRegistrationRequests,
  staffAccounts,
  academicDepartments,
  academicPrograms,
  facultyHodRequests,
  facultyHodAssignments,
  staffRoles,
} from '@/db/schema';

// Mock Next.js Headers & Cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name) => (name === 'admin_auth' ? { value: 'mock-admin-token' } : undefined)),
  })),
  headers: vi.fn(() => new Headers()),
}));

// Mock Auth
vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

// Mock Email
vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  getBaseUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}));

// Mock Realtime SSE
vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn().mockResolvedValue(true),
}));

// Mock Logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, cb) => cb()),
  },
}));

// In-Memory Mock Datasets
let mockStaffRegistrationRequestsData = [];
let mockStaffAccountsData = [];
let mockDepartmentsData = [];
let mockProgramsData = [];
let mockHodRequestsData = [];
let mockHodAssignmentsData = [];
let mockRolesData = [];
let dbSelectThrows = null;

function getTableData(table) {
  if (table === staffRegistrationRequests || table?._?.name === 'staff_registration_requests') {
    return mockStaffRegistrationRequestsData;
  }
  if (table === academicDepartments || table?._?.name === 'academic_departments') {
    return mockDepartmentsData;
  }
  if (table === academicPrograms || table?._?.name === 'academic_programs') {
    return mockProgramsData;
  }
  if (table === facultyHodRequests || table?._?.name === 'faculty_hod_requests') {
    return mockHodRequestsData;
  }
  if (table === facultyHodAssignments || table?._?.name === 'faculty_hod_assignments') {
    return mockHodAssignmentsData;
  }
  if (table === staffRoles || table?._?.name === 'staff_roles') {
    return mockRolesData;
  }
  if (table === staffAccounts || table?._?.name === 'staff_accounts') {
    return mockStaffAccountsData;
  }
  return [];
}

function createQueryBuilder(tableGetter) {
  let selectedTable = null;
  const qb = {
    from: vi.fn((table) => {
      selectedTable = table;
      return qb;
    }),
    leftJoin: vi.fn(() => qb),
    innerJoin: vi.fn(() => qb),
    where: vi.fn(() => qb),
    orderBy: vi.fn(() => qb),
    for: vi.fn(() => qb),
    then: (onFulfilled, onRejected) => {
      if (dbSelectThrows) {
        return Promise.reject(dbSelectThrows).catch(onRejected);
      }
      const data = tableGetter ? tableGetter(selectedTable) : getTableData(selectedTable);
      return Promise.resolve(data).then(onFulfilled, onRejected);
    },
  };
  return qb;
}

const mockTx = {
  select: vi.fn(() => createQueryBuilder()),
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue([{ insertId: 101 }]),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    })),
  })),
};

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => createQueryBuilder()),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 101 }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      })),
    })),
    transaction: vi.fn(async (cb) => cb(mockTx)),
  },
}));

describe('Admin Staff & HOD Requests Workflow API Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbSelectThrows = null;

    mockRolesData = [
      { id: 1, role_code: 'FACULTY', description: 'Teaching Faculty' },
      { id: 2, role_code: 'ADMISSION_STAFF', description: 'Admission Staff' },
      { id: 3, role_code: 'SCHOLARSHIP_STAFF', description: 'Scholarship Staff' },
    ];

    mockDepartmentsData = [
      { id: 1, department_code: 'CSE', department_name: 'Computer Science and Engineering' },
      { id: 2, department_code: 'ECE', department_name: 'Electronics and Communication Engineering' },
    ];

    mockProgramsData = [
      { id: 1, department_id: 1, program_code: 'BTECH', program_name: 'Bachelor of Technology' },
      { id: 2, department_id: 1, program_code: 'MTECH', program_name: 'Master of Technology' },
    ];

    mockStaffRegistrationRequestsData = [
      {
        id: 1,
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC_CSE_042',
        staff_category: 'FACULTY',
        requested_role: 'FACULTY',
        designation: 'Assistant Professor',
        address: 'Warangal Urban, Telangana - 506009',
        academic_affiliations: '[{"department_code":"CSE","program_codes":["BTECH"]}]',
        email_verified_at: new Date('2026-08-28T10:00:00Z'),
        status: 'PENDING',
        rejection_reason: null,
        processed_at: null,
        processed_by_admin_id: null,
        created_at: new Date('2026-08-28T10:00:00Z'),
        updated_at: new Date('2026-08-28T10:00:00Z'),
        account_status: null,
      },
      {
        id: 2,
        name: 'S. Anitha',
        email: 'anitha@kucet.ac.in',
        employee_id: 'ADM_001',
        staff_category: 'ADMISSION_STAFF',
        requested_role: 'ADMISSION_STAFF',
        designation: 'Junior Assistant',
        address: 'Hanamkonda, Warangal - 506001',
        academic_affiliations: [],
        email_verified_at: new Date('2026-08-29T10:00:00Z'),
        status: 'PENDING',
        rejection_reason: null,
        processed_at: null,
        processed_by_admin_id: null,
        created_at: new Date('2026-08-29T10:00:00Z'),
        updated_at: new Date('2026-08-29T10:00:00Z'),
        account_status: null,
      },
    ];

    mockStaffAccountsData = [
      {
        id: 101,
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC_CSE_042',
        account_status: 'PENDING_ACTIVATION',
      },
    ];

    mockHodRequestsData = [
      {
        id: 1,
        staff_account_id: 101,
        department_code: 'CSE',
        department_name: 'Computer Science and Engineering',
        academic_year: '2026-2027',
        status: 'PENDING',
        rejection_reason: null,
        reviewed_at: null,
        created_at: new Date('2026-08-28T10:00:00Z'),
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC_CSE_042',
        staff_category: 'FACULTY',
      },
    ];

    mockHodAssignmentsData = [
      {
        department_code: 'CSE',
        academic_year: '2026-2027',
        name: 'Dr. Existing HOD',
      },
    ];
  });

  describe('GET /api/admin/staff-requests', () => {
    it('should return 401 if user is not authenticated as admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(401);
    });

    it('should return 200 with formatted registration requests for admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });

      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.requests)).toBe(true);
      expect(data.requests).toHaveLength(2);

      // Verify first request formatting and department mapping
      const firstReq = data.requests[0];
      expect(firstReq.id).toBe(1);
      expect(firstReq.name).toBe('Dr. K. Ramesh');
      expect(firstReq.address).toBe('Warangal Urban, Telangana - 506009');
      expect(Array.isArray(firstReq.academic_affiliations)).toBe(true);
      expect(firstReq.academic_affiliations[0].department_code).toBe('CSE');
      expect(firstReq.academic_affiliations[0].department_name).toBe('Computer Science and Engineering');
      expect(firstReq.academic_affiliations[0].program_names).toContain('Bachelor of Technology');

      // Verify second request formatting (empty affiliations)
      const secondReq = data.requests[1];
      expect(secondReq.id).toBe(2);
      expect(secondReq.address).toBe('Hanamkonda, Warangal - 506001');
      expect(secondReq.academic_affiliations).toEqual([]);
    });

    it('should return 200 with empty list when no registration requests exist', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      mockStaffRegistrationRequestsData = [];

      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.requests).toEqual([]);
    });

    it('should return 500 controlled error when database query fails', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      dbSelectThrows = new Error('Database connection failed: ECONNREFUSED');

      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
      expect(data.error).not.toContain('ECONNREFUSED'); // Verifies client sanitization
    });
  });

  describe('POST /api/admin/staff-requests/[id]/approve', () => {
    it('should return 401 if user is not admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await approveStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/approve', { method: 'POST' }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(401);
    });

    it('should return 400 when invalid request ID is supplied', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await approveStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/invalid/approve', { method: 'POST' }),
        { params: Promise.resolve({ id: 'invalid' }) }
      );
      expect(res.status).toBe(400);
    });

    it('should approve valid staff request, create account, and send activation email', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });

      const res = await approveStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/approve', { method: 'POST' }),
        { params: Promise.resolve({ id: '1' }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('approved');
    });
  });

  describe('POST /api/admin/staff-requests/[id]/reject', () => {
    it('should return 401 if user is not admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await rejectStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: 'Valid rejection reason' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(401);
    });

    it('should reject when rejection reason is too short', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await rejectStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: 'No' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(400);
    });

    it('should reject valid staff registration request with reason', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await rejectStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: 'Invalid academic credentials provided' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Request rejected');
    });
  });

  describe('POST /api/admin/staff-requests/[id]/resend-activation', () => {
    it('should return 401 if user is not admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await resendActivationRequest(
        new Request('http://localhost/api/admin/staff-requests/1/resend-activation', { method: 'POST' }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(401);
    });

    it('should resend activation email for approved staff request', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });

      mockStaffRegistrationRequestsData = [
        {
          id: 1,
          name: 'Dr. K. Ramesh',
          email: 'ramesh@kucet.ac.in',
          status: 'APPROVED',
        },
      ];

      const res = await resendActivationRequest(
        new Request('http://localhost/api/admin/staff-requests/1/resend-activation', { method: 'POST' }),
        { params: Promise.resolve({ id: '1' }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('resent successfully');
    });
  });

  describe('GET /api/admin/hod-requests', () => {
    it('should return 401 if user is not authenticated as admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await listHodRequests(new Request('http://localhost/api/admin/hod-requests'));
      expect(res.status).toBe(401);
    });

    it('should return 200 with enriched HOD requests for admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await listHodRequests(new Request('http://localhost/api/admin/hod-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].current_hod_name).toBe('Dr. Existing HOD');
    });

    it('should return 200 with empty list when no HOD requests exist', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      mockHodRequestsData = [];

      const res = await listHodRequests(new Request('http://localhost/api/admin/hod-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requests).toEqual([]);
    });
  });

  describe('Drizzle Schema & Column Integrity', () => {
    it('staffRegistrationRequests table schema contains required columns', async () => {
      const { staffRegistrationRequests: srr } = await import('@/db/schema/identity.js');
      expect(srr.id).toBeDefined();
      expect(srr.name).toBeDefined();
      expect(srr.email).toBeDefined();
      expect(srr.employee_id).toBeDefined();
      expect(srr.staff_category).toBeDefined();
      expect(srr.requested_role).toBeDefined();
      expect(srr.designation).toBeDefined();
      expect(srr.address).toBeDefined();
      expect(srr.academic_affiliations).toBeDefined();
      expect(srr.email_verified_at).toBeDefined();
      expect(srr.status).toBeDefined();
    });

    it('staffAccounts table schema contains required columns', async () => {
      const { staffAccounts: sa } = await import('@/db/schema/identity.js');
      expect(sa.id).toBeDefined();
      expect(sa.name).toBeDefined();
      expect(sa.email).toBeDefined();
      expect(sa.employee_id).toBeDefined();
      expect(sa.staff_category).toBeDefined();
      expect(sa.designation).toBeDefined();
      expect(sa.address).toBeDefined();
      expect(sa.account_status).toBeDefined();
    });

    it('facultyHodAssignments table schema contains department_code column', async () => {
      const { facultyHodAssignments: fha } = await import('@/db/schema/operations.js');
      expect(fha.staff_account_id).toBeDefined();
      expect(fha.department_code).toBeDefined();
      expect(fha.academic_year).toBeDefined();
      expect(fha.start_date).toBeDefined();
      expect(fha.end_date).toBeDefined();
      expect(fha.is_active).toBeDefined();
    });
  });
});
