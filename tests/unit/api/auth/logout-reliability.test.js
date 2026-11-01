import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as refreshPOST } from '@/app/api/auth/refresh/route';
import { handleLogoutRevocation, clearAllAuthCookies } from '@/lib/auth-utils';
import { db } from '@/db';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/clock', () => {
  const mockNow = new Date('2026-09-04T10:00:00Z');
  return {
    getNow: vi.fn(() => mockNow),
    Clock: {
      now: vi.fn(() => mockNow),
      nowString: vi.fn(() => '2026-09-04 10:00:00'),
    },
    default: {
      now: vi.fn(() => mockNow),
    }
  };
});

const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    query: {
      refreshTokens: {
        findFirst: vi.fn(),
      },
      userSessions: {
        findFirst: vi.fn(),
      },
      staffAccounts: {
        findFirst: vi.fn(),
      },
    },
  },
}));

function createChainMock(resolveValue = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    then: (fn) => Promise.resolve(resolveValue).then(fn),
  };
  return chain;
}

describe('Logout Reliability & Revocation Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'super_secret_jwt_key_that_is_long_enough_for_test';
  });

  describe('handleLogoutRevocation logic', () => {
    it('sets revoked_at timestamp AND explicitly sets replaced_by_token_id to null', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({})
      });
      db.update.mockReturnValue({ set: mockSet });

      const mockRequest = {
        cookies: {
          get: (name) => {
            if (name === 'staff_refresh_token') return { value: 'raw-refresh-token-xyz' };
            if (name === 'staff_session_id') return { value: '42' };
            return null;
          }
        }
      };

      await handleLogoutRevocation(mockRequest, 'staff');

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        revoked_at: expect.any(Date),
        replaced_by_token_id: null
      }));
    });
  });

  describe('POST /api/auth/refresh — Zero Grace Revival on Explicit Logout', () => {
    it('immediately rejects explicitly revoked tokens with 401, completely bypassing the grace period', async () => {
      const revokedAt = new Date('2026-09-04T09:59:50Z'); // Revoked 10 seconds ago
      const mockTokenRow = {
        id: 501,
        user_id: '10',
        user_type: 'staff',
        token_hash: 'revoked-hash',
        revoked_at: revokedAt,
        replaced_by_token_id: null, // Explicit logout marker
        expires_at: new Date('2026-09-05T10:00:00Z')
      };

      mockCookies.mockReturnValue({
        get: (name) => {
          if (name === 'staff_session_id') return { value: '42' };
          if (name === 'staff_refresh_token') return { value: 'raw-refresh-token' };
          return null;
        }
      });

      // Session row: is_revoked = false, is_current = true
      const mockSessionRow = {
        id: 42,
        user_id: '10',
        user_type: 'staff',
        is_current: true,
        is_revoked: false,
        expires_at: new Date('2026-09-05T10:00:00Z')
      };

      db.query.refreshTokens.findFirst.mockResolvedValue(mockTokenRow);
      db.query.userSessions.findFirst.mockResolvedValue(mockSessionRow);

      const req = {
        json: async () => ({ type: 'staff' }),
        headers: {
          get: () => null
        }
      };

      const res = await refreshPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Session has been logged out');
    });

    it('honors the 120s grace period ONLY when token has legitimate replacement (replaced_by_token_id > 0)', async () => {
      const rotatedAt = new Date('2026-09-04T09:59:50Z'); // Rotated 10 seconds ago
      const mockRotatedTokenRow = {
        id: 502,
        user_id: '10',
        user_type: 'staff',
        token_hash: 'rotated-hash',
        revoked_at: rotatedAt,
        replaced_by_token_id: 503, // Legitimate successor token exists!
        expires_at: new Date('2026-09-05T10:00:00Z')
      };

      const mockSessionRow = {
        id: 42,
        user_id: '10',
        user_type: 'staff',
        is_current: true,
        is_revoked: false,
        expires_at: new Date('2026-09-05T10:00:00Z')
      };

      const mockStaff = {
        id: 10,
        name: 'Faculty User',
        email: 'faculty@kucet.ac.in',
        account_status: 'ACTIVE',
        status: 'ACTIVE',
        role: 'faculty',
        branch: 'CSE'
      };

      mockCookies.mockReturnValue({
        get: (name) => {
          if (name === 'staff_session_id') return { value: '42' };
          if (name === 'staff_refresh_token') return { value: 'raw-rotated-token' };
          return null;
        }
      });

      db.query.refreshTokens.findFirst.mockResolvedValue(mockRotatedTokenRow);
      db.query.userSessions.findFirst.mockResolvedValue(mockSessionRow);
      db.query.staffAccounts.findFirst.mockResolvedValue(mockStaff);

      db.select
        .mockReturnValueOnce(createChainMock([])) // Roles query
        .mockReturnValueOnce(createChainMock([])) // Affiliations query
        .mockReturnValueOnce(createChainMock([])) // HOD query
        .mockReturnValueOnce(createChainMock([])); // Coord query

      db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve({})) })) });
      db.insert.mockReturnValue({ values: vi.fn(() => Promise.resolve({ insertId: 504 })) });

      const req = {
        json: async () => ({ type: 'staff' }),
        headers: {
          get: () => null
        }
      };

      const res = await refreshPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('clearAllAuthCookies', () => {
    it('sets maxAge: 0 and 1970 expiration for all auth and companion cookies', () => {
      const res = NextResponse.json({ success: true });
      const cookieSpy = vi.spyOn(res.cookies, 'set');

      clearAllAuthCookies(res);

      expect(cookieSpy).toHaveBeenCalledWith('staff_auth', '', expect.objectContaining({ maxAge: 0 }));
      expect(cookieSpy).toHaveBeenCalledWith('staff_refresh_token', '', expect.objectContaining({ maxAge: 0 }));
      expect(cookieSpy).toHaveBeenCalledWith('staff_logged_in', '', expect.objectContaining({ maxAge: 0, httpOnly: false }));
      expect(cookieSpy).toHaveBeenCalledWith('admin_auth', '', expect.objectContaining({ maxAge: 0 }));
      expect(cookieSpy).toHaveBeenCalledWith('admin_logged_in', '', expect.objectContaining({ maxAge: 0, httpOnly: false }));
      expect(cookieSpy).toHaveBeenCalledWith('student_auth', '', expect.objectContaining({ maxAge: 0 }));
      expect(cookieSpy).toHaveBeenCalledWith('student_logged_in', '', expect.objectContaining({ maxAge: 0, httpOnly: false }));
    });
  });
});
