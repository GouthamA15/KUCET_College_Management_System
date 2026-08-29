import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthUser, wrapHandler } from '@/lib/api-utils';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/db', () => {
  const selectMock = vi.fn().mockReturnThis();
  const fromMock = vi.fn().mockReturnThis();
  const innerJoinMock = vi.fn().mockReturnThis();
  const whereMock = vi.fn().mockResolvedValue([{ role_code: 'HOD' }]);
  
  return {
    db: {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: whereMock
          })
        })
      }),
      query: {
        facultyHodAssignments: {
          findFirst: vi.fn(),
        }
      }
    }
  };
});

vi.mock('@/lib/auth-utils', () => ({
  verifyJwt: vi.fn(),
  verifyAuthToken: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

describe('Staff Identity & Authorization Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthUser - Multi-Role Capability & Isolation Guardrails', () => {
    it('resolves Admission Staff identity and enforces role boundaries', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth') return { value: 'admission-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 101,
        staffId: 101,
        email: 'admission@kucet.ac.in',
        role: 'admission',
        is_hod: false,
        branch: null,
      });

      // Staff umbrella
      const asStaff = await getAuthUser('staff');
      expect(asStaff).not.toBeNull();
      expect(asStaff.role).toBe('admission');
      expect(asStaff.staffId).toBe(101);

      // Admission specific
      const asAdmission = await getAuthUser('admission');
      expect(asAdmission).not.toBeNull();
      expect(asAdmission.role).toBe('admission');

      // Cross-role isolation: Scholarship, Faculty, HOD should fail
      const asScholarship = await getAuthUser('scholarship');
      expect(asScholarship).toBeNull();

      const asFaculty = await getAuthUser('faculty');
      expect(asFaculty).toBeNull();

      const asHod = await getAuthUser('hod');
      expect(asHod).toBeNull();
    });

    it('resolves Scholarship Staff identity and enforces role boundaries', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth') return { value: 'scholarship-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 102,
        staffId: 102,
        email: 'scholarship@kucet.ac.in',
        role: 'scholarship',
        is_hod: false,
        branch: null,
      });

      // Staff umbrella
      const asStaff = await getAuthUser('staff');
      expect(asStaff).not.toBeNull();
      expect(asStaff.role).toBe('scholarship');

      // Scholarship specific
      const asScholarship = await getAuthUser('scholarship');
      expect(asScholarship).not.toBeNull();
      expect(asScholarship.role).toBe('scholarship');

      // Cross-role isolation: Admission, Faculty, HOD should fail
      const asAdmission = await getAuthUser('admission');
      expect(asAdmission).toBeNull();

      const asFaculty = await getAuthUser('faculty');
      expect(asFaculty).toBeNull();

      const asHod = await getAuthUser('hod');
      expect(asHod).toBeNull();
    });

    it('resolves Faculty identity without HOD privileges', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth') return { value: 'faculty-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 103,
        staffId: 103,
        email: 'faculty@kucet.ac.in',
        role: 'faculty',
        is_hod: false,
        branch: 'CSE',
      });

      // Staff umbrella
      const asStaff = await getAuthUser('staff');
      expect(asStaff).not.toBeNull();

      // Faculty specific
      const asFaculty = await getAuthUser('faculty');
      expect(asFaculty).not.toBeNull();
      expect(asFaculty.branch).toBe('CSE');

      // HOD should fail since is_hod is false
      const asHod = await getAuthUser('hod');
      expect(asHod).toBeNull();

      // Cross-role isolation
      const asAdmission = await getAuthUser('admission');
      expect(asAdmission).toBeNull();
      const asScholarship = await getAuthUser('scholarship');
      expect(asScholarship).toBeNull();
    });

    it('resolves Faculty identity WITH HOD privileges', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth') return { value: 'hod-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 104,
        staffId: 104,
        email: 'cse_hod@kucet.ac.in',
        role: 'faculty',
        is_hod: true,
        branch: 'CSE',
      });
      
      const { db } = await import('@/db');
      db.query.facultyHodAssignments.findFirst.mockResolvedValueOnce({
        department_code: 'CSE',
        is_active: true
      });

      // Staff umbrella
      const asStaff = await getAuthUser('staff');
      expect(asStaff).not.toBeNull();

      // Faculty specific
      const asFaculty = await getAuthUser('faculty');
      expect(asFaculty).not.toBeNull();

      // HOD specific
      const asHod = await getAuthUser('hod');
      expect(asHod).not.toBeNull();
      expect(asHod.is_hod).toBe(true);
    });

    it('grants Super Admin access across all staff sub-roles', async () => {
      cookies.mockImplementation(async () => ({
        get: vi.fn((name) => {
          if (name === 'admin_auth') return { value: 'admin-token' };
          return undefined;
        }),
      }));
      headers.mockImplementation(async () => ({
        get: vi.fn(() => null),
      }));
      verifyJwt.mockImplementation(async () => ({
        id: 1,
        email: 'admin@kucet.ac.in',
        role: 'admin',
      }));

      expect(await getAuthUser('admin')).not.toBeNull();
      expect(await getAuthUser('staff')).not.toBeNull();
      expect(await getAuthUser('admission')).not.toBeNull();
      expect(await getAuthUser('scholarship')).not.toBeNull();
      expect(await getAuthUser('faculty')).not.toBeNull();
      expect(await getAuthUser('hod')).not.toBeNull();
    });

    it('returns null when unauthenticated', async () => {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });

      expect(await getAuthUser('staff')).toBeNull();
      expect(await getAuthUser('admission')).toBeNull();
      expect(await getAuthUser('scholarship')).toBeNull();
      expect(await getAuthUser('faculty')).toBeNull();
      expect(await getAuthUser('hod')).toBeNull();
    });
  });

  describe('wrapHandler - Authentication Guard Enforcement', () => {
    it('executes handler successfully when staff auth matches', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth') return { value: 'valid-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 201,
        staffId: 201,
        email: 'staff@kucet.ac.in',
        role: 'admission',
      });

      const handler = vi.fn().mockResolvedValue({ success: true, count: 42 });
      const wrapped = wrapHandler({
        auth: 'staff',
        handler,
      });

      const req = new Request('http://localhost:3000/api/staff/students/search');
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(42);
      expect(handler).toHaveBeenCalled();
    });

    it('returns 401 Unauthorized when auth token is missing', async () => {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });

      const handler = vi.fn();
      const wrapped = wrapHandler({
        auth: 'staff',
        handler,
      });

      const req = new Request('http://localhost:3000/api/staff/students/search');
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects legacy clerk_auth cookie with 401 Unauthorized', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'clerk_auth') return { value: 'legacy-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });

      const handler = vi.fn();
      const wrapped = wrapHandler({
        auth: 'staff',
        handler,
      });

      const req = new Request('http://localhost:3000/api/staff/students/search');
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects legacy x-clerk-auth header with 401 Unauthorized', async () => {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'x-clerk-auth') return 'legacy-header-token';
          return null;
        }),
      });

      const handler = vi.fn();
      const wrapped = wrapHandler({
        auth: 'staff',
        handler,
      });

      const req = new Request('http://localhost:3000/api/staff/students/search');
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Enterprise RBAC - Role Capability Matrix', () => {
    it('enforces Admission Staff capabilities and boundaries', () => {
      expect(hasPermission('admission', PERMISSIONS.CERTIFICATE_APPROVE)).toBe(true);
      expect(hasPermission('admission', PERMISSIONS.REPORT_EXPORT)).toBe(true);
      expect(hasPermission('admission', PERMISSIONS.VIEW_OWN_RECORDS)).toBe(true);

      // Boundaries
      expect(hasPermission('admission', PERMISSIONS.FEE_VERIFY)).toBe(false);
      expect(hasPermission('admission', PERMISSIONS.ATTENDANCE_MARK)).toBe(false);
      expect(hasPermission('admission', PERMISSIONS.MARK_APPROVE)).toBe(false);
    });

    it('enforces Scholarship Staff capabilities and boundaries', () => {
      expect(hasPermission('scholarship', PERMISSIONS.FEE_VERIFY)).toBe(true);
      expect(hasPermission('scholarship', PERMISSIONS.FEE_EDIT)).toBe(true);
      expect(hasPermission('scholarship', PERMISSIONS.REPORT_EXPORT)).toBe(true);
      expect(hasPermission('scholarship', PERMISSIONS.VIEW_OWN_RECORDS)).toBe(true);

      // Boundaries
      expect(hasPermission('scholarship', PERMISSIONS.CERTIFICATE_APPROVE)).toBe(false);
      expect(hasPermission('scholarship', PERMISSIONS.ATTENDANCE_MARK)).toBe(false);
      expect(hasPermission('scholarship', PERMISSIONS.ARCHIVE_RUN)).toBe(false);
    });

    it('enforces Faculty capabilities and boundaries', () => {
      expect(hasPermission('faculty', PERMISSIONS.ATTENDANCE_MARK)).toBe(true);
      expect(hasPermission('faculty', PERMISSIONS.MARK_ENTRY)).toBe(true);
      expect(hasPermission('faculty', PERMISSIONS.VIEW_OWN_RECORDS)).toBe(true);

      // Boundaries
      expect(hasPermission('faculty', PERMISSIONS.MARK_APPROVE)).toBe(false);
      expect(hasPermission('faculty', PERMISSIONS.ATTENDANCE_EDIT)).toBe(false);
      expect(hasPermission('faculty', PERMISSIONS.FEE_EDIT)).toBe(false);
    });

    it('enforces HOD elevated departmental capabilities', () => {
      expect(hasPermission('hod', PERMISSIONS.MARK_APPROVE)).toBe(true);
      expect(hasPermission('hod', PERMISSIONS.ATTENDANCE_EDIT)).toBe(true);
      expect(hasPermission('hod', PERMISSIONS.ATTENDANCE_MARK)).toBe(true);
      expect(hasPermission('hod', PERMISSIONS.MARK_ENTRY)).toBe(true);
      expect(hasPermission('hod', PERMISSIONS.REPORT_EXPORT)).toBe(true);

      // Boundaries: HOD does not have system-wide admin privileges
      expect(hasPermission('hod', PERMISSIONS.ARCHIVE_RUN)).toBe(false);
      expect(hasPermission('hod', PERMISSIONS.ARCHIVE_RESTORE)).toBe(false);
    });
  });
});
