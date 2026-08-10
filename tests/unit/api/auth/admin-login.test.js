import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as employeeLoginPOST } from '@/app/api/auth/employee-login/route';
import { POST as adminLoginPOST } from '@/app/api/admin/login/route';
import { getDashboardPathByRole } from '@/lib/path-utils';
import { db } from '@/db';
import bcrypt from 'bcrypt';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      principal: { findFirst: vi.fn() },
      clerks: { findFirst: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getTieredKey: vi.fn((req, key) => key),
}));

vi.mock('@/services/SecurityService', () => ({
  default: {
    updateLastLogin: vi.fn().mockResolvedValue(true),
    logSecurityEvent: vi.fn().mockResolvedValue(true),
    registerSession: vi.fn().mockResolvedValue(1),
    updateSession: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn().mockReturnValue(false),
  }),
}));

const makeMockRequest = (body) => ({
  json: async () => body,
  headers: {
    get: (name) => {
      if (name.toLowerCase() === 'x-forwarded-for') return '127.0.0.1';
      if (name.toLowerCase() === 'user-agent') return 'Mozilla/5.0 Test';
      return null;
    },
  },
});

describe('Admin Authentication & Routing Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role-based Dashboard Path Resolution', () => {
    it('should map admin role to /admin/dashboard', () => {
      expect(getDashboardPathByRole('admin')).toBe('/admin/dashboard');
    });

    it('should map admission clerk role to /clerk/admission/dashboard', () => {
      expect(getDashboardPathByRole('admission')).toBe('/clerk/admission/dashboard');
    });

    it('should map scholarship clerk role to /clerk/scholarship/dashboard', () => {
      expect(getDashboardPathByRole('scholarship')).toBe('/clerk/scholarship/dashboard');
    });

    it('should map faculty role to /clerk/faculty/dashboard', () => {
      expect(getDashboardPathByRole('faculty')).toBe('/clerk/faculty/dashboard');
    });

    it('should fallback unknown roles to /', () => {
      expect(getDashboardPathByRole('unknown')).toBe('/');
    });
  });

  describe('/api/auth/employee-login for Super Admin', () => {
    it('should successfully authenticate Super Admin and return role "admin"', async () => {
      const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
      const adminRecord = {
        id: 1,
        email: 'admin@kucet.ac.in',
        password_hash: hashedPassword,
      };

      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([adminRecord]),
          }),
        }),
      });

      db.query.principal.findFirst.mockResolvedValueOnce(adminRecord);

      const req = makeMockRequest({
        email: 'admin@kucet.ac.in',
        password: 'AdminPassword123!',
        rememberMe: false,
      });

      const res = await employeeLoginPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.role).toBe('admin');
      expect(body.message).toBe('Admin login successful');

      // Verify admin_auth cookie set
      const cookies = res.headers.getSetCookie();
      const adminAuthCookie = cookies.find((c) => c.startsWith('admin_auth='));
      const adminLoggedInCookie = cookies.find((c) => c.startsWith('admin_logged_in=true'));

      expect(adminAuthCookie).toBeDefined();
      expect(adminLoggedInCookie).toBeDefined();
    });

    it('should successfully authenticate Clerk and return specific clerk role', async () => {
      const hashedPassword = await bcrypt.hash('ClerkPassword123!', 10);
      const clerkRecord = {
        id: 5,
        email: 'admission@kucet.ac.in',
        password_hash: hashedPassword,
        role: 'admission',
        is_active: true,
        is_hod: false,
        branch: 'CSE',
      };

      // 1. Admin select returns empty
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // 2. Clerk select returns clerkRecord
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([clerkRecord]),
          }),
        }),
      });

      db.query.clerks.findFirst.mockResolvedValueOnce(clerkRecord);

      const req = makeMockRequest({
        email: 'admission@kucet.ac.in',
        password: 'ClerkPassword123!',
        rememberMe: false,
      });

      const res = await employeeLoginPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.role).toBe('admission');

      const cookies = res.headers.getSetCookie();
      const clerkAuthCookie = cookies.find((c) => c.startsWith('clerk_auth='));
      expect(clerkAuthCookie).toBeDefined();
    });
  });

  describe('/api/admin/login Direct Endpoint', () => {
    it('should authenticate admin and return role "admin"', async () => {
      const hashedPassword = await bcrypt.hash('SuperAdminKey!', 10);
      const adminRecord = {
        id: 1,
        email: 'superadmin@kucet.ac.in',
        password_hash: hashedPassword,
      };

      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([adminRecord]),
          }),
        }),
      });

      db.query.principal.findFirst.mockResolvedValueOnce(adminRecord);

      const req = makeMockRequest({
        email: 'superadmin@kucet.ac.in',
        password: 'SuperAdminKey!',
        rememberMe: true,
      });

      const res = await adminLoginPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.role).toBe('admin');
    });
  });
});
