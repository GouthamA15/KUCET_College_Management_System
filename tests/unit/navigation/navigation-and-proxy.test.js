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

  it('should purge stale companion cookies when unauthorized user accesses protected UI route', async () => {
    const req = createMockRequest({
      pathname: '/staff/admission/dashboard',
      cookies: { staff_logged_in: 'true', staff_role: 'admission' }
    });
    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    // Verify stale companion cookies are deleted on redirect
    const setCookieHeaders = res.headers.getSetCookie();
    expect(setCookieHeaders.some(c => c.includes('staff_auth=;'))).toBe(true);
    expect(setCookieHeaders.some(c => c.includes('staff_logged_in=;'))).toBe(true);
  });

  describe('First Year Coordinator Route Guards', () => {
    it('should allow valid faculty with is_first_year_coordinator to access /staff/first-year/dashboard', async () => {
      const token = await new SignJWT({
        id: 101,
        email: 'coord@kucet.ac.in',
        role: 'faculty',
        is_first_year_coordinator: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      const req = createMockRequest({
        pathname: '/staff/first-year/dashboard',
        cookies: { staff_auth: token },
      });

      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('should allow valid faculty with is_first_year_coordinator to access /staff/first-year', async () => {
      const token = await new SignJWT({
        id: 101,
        email: 'coord@kucet.ac.in',
        role: 'faculty',
        is_first_year_coordinator: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      const req = createMockRequest({
        pathname: '/staff/first-year',
        cookies: { staff_auth: token },
      });

      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('should redirect regular faculty without coordinator sub-role away from /staff/first-year/dashboard to faculty dashboard', async () => {
      const token = await new SignJWT({
        id: 102,
        email: 'regularfaculty@kucet.ac.in',
        role: 'faculty',
        is_first_year_coordinator: false,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      const req = createMockRequest({
        pathname: '/staff/first-year/dashboard',
        cookies: { staff_auth: token },
      });

      const res = await proxy(req);
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
    });

    it('should allow principal with staff token to access /staff/first-year/dashboard', async () => {
      const principalToken = await new SignJWT({
        id: 105,
        email: 'principal@kucet.ac.in',
        role: 'faculty',
        is_principal: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      const reqPrincipal = createMockRequest({
        pathname: '/staff/first-year/dashboard',
        cookies: { staff_auth: principalToken },
      });

      const resPrincipal = await proxy(reqPrincipal);
      expect(resPrincipal.status).toBe(200);
      expect(resPrincipal.headers.get('location')).toBeNull();
    });

    it('should trigger silent refresh and allow access if token is refreshed with is_first_year_coordinator: true', async () => {
      const staleToken = await new SignJWT({
        id: 106,
        email: 'newcoord@kucet.ac.in',
        role: 'faculty',
        is_first_year_coordinator: false,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      const refreshedToken = await new SignJWT({
        id: 106,
        email: 'newcoord@kucet.ac.in',
        role: 'faculty',
        is_first_year_coordinator: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);

      // Mock global fetch for loopback refresh endpoint
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('/api/auth/refresh')) {
          return {
            ok: true,
            status: 200,
            headers: {
              getSetCookie: () => [
                `staff_auth=${refreshedToken}; Path=/; HttpOnly; SameSite=Lax`,
              ],
              get: (h) => (h === 'set-cookie' ? `staff_auth=${refreshedToken}; Path=/; HttpOnly; SameSite=Lax` : null),
            },
            json: async () => ({ success: true, message: 'Token refreshed' }),
          };
        }
        return originalFetch(url);
      });

      try {
        const req = createMockRequest({
          pathname: '/staff/first-year/dashboard',
          cookies: {
            staff_auth: staleToken,
            staff_refresh_token: 'valid_refresh_token_string',
          },
        });

        const res = await proxy(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

