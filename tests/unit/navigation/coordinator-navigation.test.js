import { describe, it, expect, vi, beforeEach } from 'vitest';
import proxy from '@/proxy';
import { SignJWT } from 'jose';
import { isAcademicScopeAllowed, assertAcademicScope, INSTITUTIONAL_BRANCHES } from '@/lib/academic-authorization';

describe('First Year Coordinator Navigation, Route Guards & Authorization Suite', () => {
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

  it('1. Active coordinator navigates to coordinator workspace without redirection', async () => {
    const coordinatorToken = await new SignJWT({
      id: 201,
      email: 'kalpanadevimora@gmail.com',
      role: 'faculty',
      is_first_year_coordinator: true,
      branch: 'CSE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/first-year/dashboard',
      cookies: { staff_auth: coordinatorToken, staff_logged_in: 'true', staff_role: 'faculty' },
    });

    const res = await proxy(req);
    // When allowed, proxy returns 200 (NextResponse.next()) with no redirect location
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('2. Navigation works from faculty dashboard and URL resolves to coordinator workspace', async () => {
    const coordinatorToken = await new SignJWT({
      id: 201,
      email: 'kalpanadevimora@gmail.com',
      role: 'faculty',
      is_first_year_coordinator: true,
      branch: 'CSE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/first-year/dashboard',
      cookies: { staff_auth: coordinatorToken },
      headers: { referer: 'http://localhost:3000/staff/faculty/dashboard' },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('3. Normal faculty member without coordinator assignment cannot access coordinator workspace', async () => {
    const regularFacultyToken = await new SignJWT({
      id: 202,
      email: 'regular@kucet.ac.in',
      role: 'faculty',
      is_first_year_coordinator: false,
      branch: 'ECE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/first-year/dashboard',
      cookies: { staff_auth: regularFacultyToken },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
  });

  it('4. Expired or revoked coordinator assignment is denied access', async () => {
    // When assignment was revoked, token does not have is_first_year_coordinator
    const revokedToken = await new SignJWT({
      id: 203,
      email: 'revoked@kucet.ac.in',
      role: 'faculty',
      is_first_year_coordinator: false,
      branch: 'MECH',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/first-year',
      cookies: { staff_auth: revokedToken },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
  });

  it('5. Valid coordinator does not get incorrectly redirected to faculty dashboard', async () => {
    const coordinatorToken = await new SignJWT({
      id: 201,
      email: 'kalpanadevimora@gmail.com',
      role: 'faculty',
      is_first_year_coordinator: true,
      branch: 'CSE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const req = createMockRequest({
      pathname: '/staff/first-year',
      cookies: { staff_auth: coordinatorToken },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('6. Refreshing coordinator page preserves correct route and authorization', async () => {
    const coordinatorToken = await new SignJWT({
      id: 201,
      email: 'kalpanadevimora@gmail.com',
      role: 'faculty',
      is_first_year_coordinator: true,
      branch: 'CSE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    // Reload request to /staff/first-year/dashboard
    const req = createMockRequest({
      pathname: '/staff/first-year/dashboard',
      cookies: { staff_auth: coordinatorToken, staff_logged_in: 'true' },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('7. HOD and administrator navigation and permissions remain unchanged', async () => {
    const hodToken = await new SignJWT({
      id: 301,
      email: 'hodcse@kucet.ac.in',
      role: 'faculty',
      is_hod: true,
      hod_department_code: 'CSE',
      branch: 'CSE',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const adminToken = await new SignJWT({
      id: 1,
      email: 'admin@kucet.ac.in',
      role: 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    // HOD can access HOD routes
    const hodReq = createMockRequest({
      pathname: '/staff/hod/staff-management',
      cookies: { staff_auth: hodToken },
    });
    const hodRes = await proxy(hodReq);
    expect(hodRes.status).toBe(200);
    expect(hodRes.headers.get('location')).toBeNull();

    // Admin can access Admin routes
    const adminReq = createMockRequest({
      pathname: '/admin/manage-staff',
      cookies: { admin_auth: adminToken },
    });
    const adminRes = await proxy(adminReq);
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.get('location')).toBeNull();

    // Regular faculty is blocked from HOD routes
    const facultyToken = await new SignJWT({
      id: 302,
      email: 'faculty@kucet.ac.in',
      role: 'faculty',
      is_hod: false,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secretKey);

    const blockReq = createMockRequest({
      pathname: '/staff/hod/staff-management',
      cookies: { staff_auth: facultyToken },
    });
    const blockRes = await proxy(blockReq);
    expect(blockRes.status).toBe(303);
    expect(blockRes.headers.get('location')).toBe('http://localhost:3000/staff/faculty/dashboard');
  });

  it('8. Coordinator API requests enforce the same scope as the UI (Semesters 1-2 across branches)', () => {
    const coordinatorUser = {
      id: 201,
      role: 'faculty',
      is_first_year_coordinator: true,
      branch: 'CSE',
    };

    const regularFaculty = {
      id: 202,
      role: 'faculty',
      is_first_year_coordinator: false,
      branch: 'CSE',
    };

    // Coordinator is authorized for Semesters 1 and 2 across all institutional branches
    for (const b of INSTITUTIONAL_BRANCHES) {
      expect(isAcademicScopeAllowed(coordinatorUser, { branch: b, semester: 1 })).toBe(true);
      expect(isAcademicScopeAllowed(coordinatorUser, { branch: b, semester: 2 })).toBe(true);
      // Denied for higher semesters
      expect(isAcademicScopeAllowed(coordinatorUser, { branch: b, semester: 3 })).toBe(false);
      expect(isAcademicScopeAllowed(coordinatorUser, { branch: b, semester: 7 })).toBe(false);
    }

    // Regular faculty is denied coordinator scope
    expect(isAcademicScopeAllowed(regularFaculty, { branch: 'ECE', semester: 1 })).toBe(false);

    // assertAcademicScope throws Forbidden 403 on violations
    expect(() => {
      assertAcademicScope(coordinatorUser, { branch: 'CSE', semester: 4 });
    }).toThrow(/Forbidden/);
  });
});
