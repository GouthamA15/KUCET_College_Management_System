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

describe('KUCET Admission Bridge — Session & Auth Endpoint Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/admission/bridge/session', () => {
    it('should return 401 Unauthorized when no staff user session exists', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('should return 403 Forbidden when role is not authorized (e.g. faculty)', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 25, email: 'faculty@kucet.ac.in', role: 'faculty' });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should return 403 Forbidden when role is scholarship', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 26, email: 'scholarship@kucet.ac.in', role: 'scholarship' });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should return 200 with user session details when role is admission', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 12,
        email: 'admission@kucet.ac.in',
        name: 'K. Ramesh',
        role: 'admission',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.email).toBe('admission@kucet.ac.in');
      expect(json.user.role).toBe('admission');
      expect(json.user.name).toBe('K. Ramesh');
    });

    it('should return 200 with user session details when role is admission_clerk', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 15,
        email: 'clerk@kucet.ac.in',
        role: 'admission_clerk',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.role).toBe('admission_clerk');
    });

    it('should return 200 when role is admin or super_admin', async () => {
      mockGetAuthUser.mockResolvedValue({
        id: 1,
        email: 'admin@kucet.ac.in',
        name: 'Principal Office',
        role: 'admin',
      });

      const { GET } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.authorized).toBe(true);
      expect(json.user.role).toBe('admin');
    });
  });

  describe('DELETE /api/staff/admission/bridge/session', () => {
    it('should revoke sessions, clear cookies, and return success', async () => {
      mockHandleLogoutRevocation.mockResolvedValue(true);

      const { DELETE } = await import('@/app/api/staff/admission/bridge/session/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/session', {
        method: 'DELETE',
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockHandleLogoutRevocation).toHaveBeenCalledWith(req, 'staff');
      expect(mockHandleLogoutRevocation).toHaveBeenCalledWith(req, 'admin');
      expect(mockClearAllAuthCookies).toHaveBeenCalled();
    });
  });
});
