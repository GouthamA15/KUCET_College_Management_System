import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDashboardPathByRole } from '@/lib/path-utils';
import { parseSetCookieString } from '@/lib/parse-set-cookie';
import { isTimeMachineEnabled, parseMockDateInput } from '@/lib/clock';

async function verify(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return { payload, expired: false };
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      return { payload: null, expired: true };
    }
    return { payload: null, expired: false };
  }
}

const inflightProxyRefreshes = new Map();

async function trySilentRefresh(request, userType, jwtSecret) {
  try {
    const host = request.headers.get('host') || request.nextUrl.host || 'localhost';
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const cookieHeader = request.headers.get('cookie') || '';
    const port = process.env.PORT || 3000;
    const loopbackUrl = `http://127.0.0.1:${port}/api/auth/refresh`;

    let res;
    try {
      res = await fetch(loopbackUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'host': host,
          'x-forwarded-proto': forwardedProto,
          'cookie': cookieHeader,
        },
        body: JSON.stringify({ type: userType }),
      });
    } catch (_loopbackErr) {
      // Fallback to public origin if loopback is unreachable
      const origin = request.nextUrl.origin;
      res = await fetch(`${origin}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({ type: userType }),
      });
    }

    if (!res.ok) return null;

    const setCookieHeaders = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie')?.split(/,(?=\s*\w+=)/) || []);

    const cookiesToSet = [];
    let newAuthToken = null;

    for (const cookieStr of setCookieHeaders) {
      const parsed = parseSetCookieString(cookieStr);
      if (parsed) {
        cookiesToSet.push(parsed);
        if (parsed.name === `${userType}_auth`) {
          newAuthToken = parsed.value;
        }
      }
    }

    if (newAuthToken) {
      const verified = await verify(newAuthToken, jwtSecret);
      if (verified.payload) {
        return { payload: verified.payload, cookiesToSet, token: newAuthToken };
      }
    }
  } catch (_err) {
    // Refresh failed or network error
  }
  return null;
}

function deduplicatedSilentRefresh(request, userType, jwtSecret) {
  const refreshCookie =
    request.cookies.get(`${userType}_refresh_token`)?.value ||
    request.cookies.get(`${userType}_session_id`)?.value ||
    request.cookies.get(`${userType}_auth`)?.value ||
    'anonymous';

  const dedupeKey = `${userType}:${refreshCookie.slice(-32)}`;

  if (inflightProxyRefreshes.has(dedupeKey)) {
    return inflightProxyRefreshes.get(dedupeKey);
  }

  const promise = trySilentRefresh(request, userType, jwtSecret).finally(() => {
    inflightProxyRefreshes.delete(dedupeKey);
  });

  inflightProxyRefreshes.set(dedupeKey, promise);
  return promise;
}

function applyRefreshedCookies(response, cookiesToSet) {
  if (!cookiesToSet || !Array.isArray(cookiesToSet)) return;
  for (const c of cookiesToSet) {
    response.cookies.set(c.name, c.value, c.options);
  }
}

function handleUnauthorized(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized', message: 'Session expired or invalid' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // Redirect to home page and purge stale companion cookies to prevent infinite spinner loop
  const redirectRes = NextResponse.redirect(new URL('/', request.url), 303);
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    redirectRes.cookies.delete('admin_auth');
    redirectRes.cookies.delete('admin_logged_in');
    redirectRes.cookies.delete('admin_session_id');
    redirectRes.cookies.delete('admin_refresh_token');
  } else if (pathname.startsWith('/staff') || pathname.startsWith('/api/staff')) {
    redirectRes.cookies.delete('staff_auth');
    redirectRes.cookies.delete('staff_logged_in');
    redirectRes.cookies.delete('staff_role');
    redirectRes.cookies.delete('staff_session_id');
    redirectRes.cookies.delete('staff_refresh_token');
  } else if (pathname.startsWith('/student') || pathname.startsWith('/api/student')) {
    redirectRes.cookies.delete('student_auth');
    redirectRes.cookies.delete('student_logged_in');
    redirectRes.cookies.delete('student_session_id');
    redirectRes.cookies.delete('student_refresh_token');
  }
  return redirectRes;
}

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const staffAuth = cookies.get('staff_auth');
  const studentAuth = cookies.get('student_auth');
  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (process.env.NODE_ENV === 'production') throw new Error('FATAL: JWT_SECRET must be set in production');
    jwtSecret = 'temporary_secret_at_least_32_chars_long';
  }

  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get('x-request-id') || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  requestHeaders.set('x-request-id', requestId);

  // Time Machine Header Forwarding (Test / Dev only)
  if (isTimeMachineEnabled()) {
    const mockCookie = cookies.get('dev_mock_date');
    if (mockCookie?.value) {
      const parsed = parseMockDateInput(mockCookie.value);
      if (parsed) {
        requestHeaders.set('x-app-mock-date', mockCookie.value);
      } else {
        requestHeaders.delete('x-app-mock-date');
      }
    }
  } else {
    // In production without override: strictly purge any untrusted mock headers
    requestHeaders.delete('x-app-mock-date');
  }

  // 1. Verify existing tokens
  let adminRes = adminAuth ? await verify(adminAuth.value, jwtSecret) : { payload: null, expired: false };
  let staffRes = staffAuth ? await verify(staffAuth.value, jwtSecret) : { payload: null, expired: false };
  let studentRes = studentAuth ? await verify(studentAuth.value, jwtSecret) : { payload: null, expired: false };

  let adminPayload = adminRes.payload;
  let staffPayload = staffRes.payload;
  let studentPayload = studentRes.payload;

  // 2. Silent refresh — strictly scoped to role routes or landing page with active session companion cookies
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isStaffPath = pathname.startsWith('/staff') || pathname.startsWith('/api/staff');
  const isStudentPath = pathname.startsWith('/student') || pathname.startsWith('/api/student');
  const isHomePath = pathname === '/';

  const needsAdminRefresh =
    !adminPayload &&
    (adminRes.expired || !adminAuth) &&
    (cookies.get('admin_refresh_token') || cookies.get('admin_logged_in')) &&
    (isAdminPath || (isHomePath && cookies.get('admin_logged_in')));

  const needsStaffRefresh =
    !staffPayload &&
    (staffRes.expired || !staffAuth) &&
    (cookies.get('staff_refresh_token') || cookies.get('staff_logged_in')) &&
    (isStaffPath || (isHomePath && cookies.get('staff_logged_in')));

  const needsStudentRefresh =
    !studentPayload &&
    (studentRes.expired || !studentAuth) &&
    (cookies.get('student_refresh_token') || cookies.get('student_logged_in')) &&
    (isStudentPath || (isHomePath && cookies.get('student_logged_in')));

  const refreshResults = await Promise.all([
    needsAdminRefresh ? deduplicatedSilentRefresh(request, 'admin', jwtSecret) : Promise.resolve(null),
    needsStaffRefresh ? deduplicatedSilentRefresh(request, 'staff', jwtSecret) : Promise.resolve(null),
    needsStudentRefresh ? deduplicatedSilentRefresh(request, 'student', jwtSecret) : Promise.resolve(null),
  ]);

  const [adminRefreshed, staffRefreshed, studentRefreshed] = refreshResults;

  if (adminRefreshed) {
    adminPayload = adminRefreshed.payload;
    if (adminRefreshed.token) requestHeaders.set('x-admin-auth', adminRefreshed.token);
  } else if (adminAuth?.value) {
    requestHeaders.set('x-admin-auth', adminAuth.value);
  }

  if (staffRefreshed) {
    staffPayload = staffRefreshed.payload;
    if (staffRefreshed.token) requestHeaders.set('x-staff-auth', staffRefreshed.token);
  } else if (staffAuth?.value) {
    requestHeaders.set('x-staff-auth', staffAuth.value);
  }

  if (studentRefreshed) {
    studentPayload = studentRefreshed.payload;
    if (studentRefreshed.token) requestHeaders.set('x-student-auth', studentRefreshed.token);
  } else if (studentAuth?.value) {
    requestHeaders.set('x-student-auth', studentAuth.value);
  }

  // Base response with updated requestHeaders
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  // Helper to ensure newly refreshed cookies are never dropped across 303 redirects or next responses
  const withCookies = (targetResponse) => {
    if (adminRefreshed?.cookiesToSet) applyRefreshedCookies(targetResponse, adminRefreshed.cookiesToSet);
    if (staffRefreshed?.cookiesToSet) applyRefreshedCookies(targetResponse, staffRefreshed.cookiesToSet);
    if (studentRefreshed?.cookiesToSet) applyRefreshedCookies(targetResponse, studentRefreshed.cookiesToSet);
    return targetResponse;
  };

  withCookies(response);

  // ─── Route: Home "/" ──────────────────────────────────────────────────────
  if (pathname === '/') {
    // If valid payload exists, immediately redirect to dashboard with refreshed cookies preserved
    if (adminPayload) return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
    if (staffPayload) {
      const dashboard = getDashboardPathByRole(staffPayload.role);
      return withCookies(NextResponse.redirect(new URL(dashboard, request.url), 303));
    }
    if (studentPayload) {
      return withCookies(NextResponse.redirect(new URL('/student', request.url), 303));
    }
    return response;
  }

  // ─── Protect API Routes ───────────────────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
  } else if (pathname.startsWith('/api/staff')) {
    if (pathname.startsWith('/api/staff/academic-calendar') || pathname.startsWith('/api/staff/semesters')) {
       // These endpoints are shared with Admin for calendar management
       if (!adminPayload && !staffPayload) return handleUnauthorized(request);
    } else {
       if (!staffPayload) return handleUnauthorized(request);
    }
  }

  // ─── Protect UI Routes ────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
    if (pathname === '/admin') return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
  } else if (pathname === '/staff' || pathname.startsWith('/staff/')) {
    // Academic calendar can be accessed by Admin or HOD (Faculty)
    if (pathname.startsWith('/staff/academic-calendar')) {
      if (!adminPayload && !staffPayload) return handleUnauthorized(request);
      if (staffPayload && staffPayload.role !== 'faculty') {
        return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303));
      }
    } else {
      if (!staffPayload) return handleUnauthorized(request);
      if (pathname === '/staff') {
        const dashboard = getDashboardPathByRole(staffPayload.role);
        return withCookies(NextResponse.redirect(new URL(dashboard, request.url), 303));
      }
      if (pathname.startsWith('/staff/scholarship') && staffPayload.role !== 'scholarship') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303));
      if (pathname.startsWith('/staff/admission') && staffPayload.role !== 'admission') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303));
      if (pathname.startsWith('/staff/faculty') && staffPayload.role !== 'faculty') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303));
      if (pathname.startsWith('/staff/hod') && (staffPayload.role !== 'faculty' || !staffPayload.is_hod)) return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303));
    }
  } else if (pathname.startsWith('/student')) {
    if (!studentPayload) return handleUnauthorized(request);
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || pathname === '/student/settings/security' || pathname === '/student/profile';
    if (!isVerified && !allowedForUnverified) return withCookies(NextResponse.redirect(new URL('/student/settings/security', request.url), 303));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api/auth|api/public|api/dev|api/verify|api/health|_next/static|_next/image|favicon.ico|sw.js|manifest.json|manifest.webmanifest|robots.txt|sitemap.xml|offline|assets|screenshots).*)',
  ],
};
