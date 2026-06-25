import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/refresh/route';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    query: {
      refreshTokens: { findFirst: vi.fn() },
      userSessions: { findFirst: vi.fn() },
      students: { findFirst: vi.fn() },
      clerks: { findFirst: vi.fn() },
      principal: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
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

const mockGetNow = vi.fn(() => new Date('2026-06-02T10:00:00Z'));
vi.mock('@/lib/clock', () => ({
  getNow: () => mockGetNow(),
}));

const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/auth-utils', () => ({
  issueStudentAuthCookie: vi.fn().mockResolvedValue({}),
  issueClerkAuthCookie: vi.fn().mockResolvedValue({}),
  issueAdminAuthCookie: vi.fn().mockResolvedValue({}),
}));

// Helper to construct request
const makeMockRequest = (body, headers = {}) => {
  return {
    json: async () => body,
    headers: {
      get: (name) => headers[name.toLowerCase()] || null,
    },
  };
};

describe('/api/auth/refresh API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNow.mockReturnValue(new Date('2026-06-02T10:00:00Z'));
    process.env.JWT_SECRET = 'my_super_secret_jwt_key_that_is_long_enough_for_hmac';
  });

  it('should return 400 if user type is invalid', async () => {
    const req = makeMockRequest({ type: 'invalid' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid user type');
  });

  it('should return 401 if refresh token is missing', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Refresh token missing');
  });

  it('should return 401 if refresh token is invalid/not found in DB', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === 'student_refresh_token') return { value: 'some-token' };
        return undefined;
      }),
    });
    db.query.refreshTokens.findFirst.mockResolvedValue(undefined);

    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid refresh token');
  });

  it('should return 401 if the session is revoked in user_sessions', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === 'student_refresh_token') return { value: 'some-token' };
        if (name === 'student_session_id') return { value: '123' };
        return undefined;
      }),
    });

    const tokenRecord = {
      id: 1,
      token_hash: 'hash',
      user_id: 'STUDENT001',
      user_type: 'student',
      expires_at: new Date('2026-06-10T10:00:00Z'),
      revoked_at: null,
    };
    db.query.refreshTokens.findFirst.mockResolvedValue(tokenRecord);

    const sessionRecord = {
      id: 123,
      is_revoked: true,
      is_current: false,
      expires_at: new Date('2026-06-10T10:00:00Z'),
    };
    db.query.userSessions.findFirst.mockResolvedValue(sessionRecord);

    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Your session has been revoked. Please login again.');
  });

  it('should return success and issue new tokens in normal flow', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === 'student_refresh_token') return { value: 'some-token' };
        if (name === 'student_session_id') return { value: '123' };
        return undefined;
      }),
    });

    const tokenRecord = {
      id: 1,
      token_hash: 'hash',
      user_id: 'STUDENT001',
      user_type: 'student',
      expires_at: new Date('2026-06-10T10:00:00Z'),
      revoked_at: null,
    };
    db.query.refreshTokens.findFirst.mockResolvedValue(tokenRecord);

    const sessionRecord = {
      id: 123,
      is_revoked: false,
      is_current: true,
      expires_at: new Date('2026-06-10T10:00:00Z'),
    };
    db.query.userSessions.findFirst.mockResolvedValue(sessionRecord);

    const studentRecord = {
      id: 10,
      roll_no: 'STUDENT001',
      name: 'Test Student',
      is_email_verified: true,
    };
    db.query.students.findFirst.mockResolvedValue(studentRecord);

    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Token refreshed');
  });

  it('should succeed and refresh via grace period if recently revoked', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === 'student_refresh_token') return { value: 'some-token' };
        if (name === 'student_session_id') return { value: '123' };
        return undefined;
      }),
    });

    // Revoked 5 seconds ago
    const tokenRecord = {
      id: 1,
      token_hash: 'hash',
      user_id: 'STUDENT001',
      user_type: 'student',
      expires_at: new Date('2026-06-10T10:00:00Z'),
      revoked_at: new Date('2026-06-02T09:59:55Z'), // 5s before mock clock 10:00:00
    };
    db.query.refreshTokens.findFirst.mockResolvedValue(tokenRecord);

    const sessionRecord = {
      id: 123,
      is_revoked: false,
      is_current: true,
      expires_at: new Date('2026-06-10T10:00:00Z'),
    };
    db.query.userSessions.findFirst.mockResolvedValue(sessionRecord);

    const studentRecord = {
      id: 10,
      roll_no: 'STUDENT001',
      name: 'Test Student',
      is_email_verified: true,
    };
    db.query.students.findFirst.mockResolvedValue(studentRecord);

    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Token refreshed (grace period)');
  });

  it('should return 401 and revoke all tokens if revoked outside grace period', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === 'student_refresh_token') return { value: 'some-token' };
        if (name === 'student_session_id') return { value: '123' };
        return undefined;
      }),
    });

    // Revoked 20 seconds ago
    const tokenRecord = {
      id: 1,
      token_hash: 'hash',
      user_id: 'STUDENT001',
      user_type: 'student',
      expires_at: new Date('2026-06-10T10:00:00Z'),
      revoked_at: new Date('2026-06-02T09:59:40Z'), // 20s before mock clock 10:00:00
    };
    db.query.refreshTokens.findFirst.mockResolvedValue(tokenRecord);

    const sessionRecord = {
      id: 123,
      is_revoked: false,
      is_current: true,
      expires_at: new Date('2026-06-10T10:00:00Z'),
    };
    db.query.userSessions.findFirst.mockResolvedValue(sessionRecord);

    const req = makeMockRequest({ type: 'student' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Token revoked. Please login again.');
  });
});
