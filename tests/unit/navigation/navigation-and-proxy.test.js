import { describe, it, expect, vi, beforeEach } from 'vitest';
import proxy from '@/proxy';
import { SignJWT } from 'jose';

describe('Navigation, Proxy Guards & Silent Auth Refresh Suite', () => {
  const testSecret = 'temporary_secret_at_least_32_chars_long';
  const secretKey = new TextEncoder().encode(testSecret);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = testSecret;
  });

  const createMockRequest = ({ pathname = '/', cookies = {}, headers = {} }) => {
    const cookieMap = new Map(Object.entries(cookies));
    const url = new URL(`http://localhost:3000${pathname}`);

    return {
      nextUrl: url,
      url: url.toString(),
      headers: {
        get: (h) => headers[h.toLowerCase()] || null,
      },
      cookies: {
        get: (name) => {
          const val = cookieMap.get(name);
          return val !== undefined ? { name, value: val } : undefined;
        },
      },
    };
  };

  it('should redirect unauthenticated users on protected admin UI route to /', async () => {
    const req = createMockRequest({ pathname: '/admin/manage-staff' });
    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('should allow valid admin JWT to access /admin/manage-staff without redirection', async () => {
    const token = await new SignJWT({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/admin/manage-staff',
      cookies: { admin_auth: token },
    });

    const res = await proxy(req);
    // NextResponse.next() returns a 200 equivalent
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should redirect valid admin at / to /admin/dashboard', async () => {
    const token = await new SignJWT({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/',
      cookies: { admin_auth: token },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard');
  });

  it('should redirect valid faculty staff at / to /staff/faculty/dashboard', async () => {
    const token = await new SignJWT({ id: 2, email: 'faculty@kucet.ac.in', role: 'faculty' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/',
      cookies: { staff_auth: token },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
  });

  it('should redirect role mismatch on staff portal (faculty trying to access /staff/scholarship)', async () => {
    const token = await new SignJWT({ id: 2, email: 'faculty@kucet.ac.in', role: 'faculty' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/scholarship',
      cookies: { staff_auth: token },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
  });

  it('should return 401 JSON for unauthorized API route access', async () => {
    const req = createMockRequest({ pathname: '/api/admin/staff' });
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
});
