import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAuthUser = vi.fn();
const mockClearAllAuthCookies = vi.fn();
const mockHandleLogoutRevocation = vi.fn();

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: (...args) => mockGetAuthUser(...args),
  };
});

vi.mock('@/lib/auth-utils', () => ({
  clearAllAuthCookies: (...args) => mockClearAllAuthCookies(...args),
  handleLogoutRevocation: (...args) => mockHandleLogoutRevocation(...args),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('KUCET Admission Bridge — Standalone Authentication & RBAC Contract Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Verification & Role Boundaries', () => {
    it('should grant access to staff with role "admission"', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 101,
        email: 'admission.head@kucet.ac.in',
        name: 'Admission Officer',
        role: 'admission',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.role).toBe('admission');
    });

    it('should grant access to staff with role "admission_clerk"', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 102,
        email: 'admission.clerk@kucet.ac.in',
        name: 'Admission Clerk',
        role: 'admission_clerk',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
    });

    it('should grant access to administrators with role "admin"', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 1,
        email: 'principal@kucet.ac.in',
        name: 'Principal',
        role: 'admin',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.role).toBe('admin');
    });

    it('should grant access to administrators with role "super_admin"', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 2,
        email: 'superadmin@kucet.ac.in',
        name: 'Super Admin',
        role: 'super_admin',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.role).toBe('super_admin');
    });

    it('should strictly reject "faculty" role with 403 Forbidden', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 201,
        email: 'faculty.cse@kucet.ac.in',
        name: 'Faculty Member',
        role: 'faculty',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should strictly reject "scholarship" role with 403 Forbidden', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 202,
        email: 'scholarship@kucet.ac.in',
        name: 'Scholarship Clerk',
        role: 'scholarship',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should strictly reject unauthenticated requests with 401 Unauthorized', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const res = await GET();

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });
  });

  describe('Session Termination & Cookie Revocation Contract', () => {
    it('should revoke staff and admin sessions and trigger site data cleanup', async () => {
      mockHandleLogoutRevocation.mockResolvedValue(true);

      const { DELETE } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session', {
        method: 'DELETE',
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Clear-Site-Data')).toContain('"cache", "storage"');
      expect(mockClearAllAuthCookies).toHaveBeenCalled();
    });
  });
});
