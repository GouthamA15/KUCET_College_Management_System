import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDashboardPathByRole } from '@/lib/path-utils';
import { parseSetCookieString } from '@/lib/parse-set-cookie';

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

async function trySilentRefresh(request, userType, jwtSecret) {
  try {
    const origin = request.nextUrl.origin;
    const cookieHeader = request.headers.get('cookie') || '';
    const res = await fetch(`${origin}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({ type: userType }),
    });

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

function applyRefreshedCookies(response, cookiesToSet) {
  if (!cookiesToSet || !Array.isArray(cookiesToSet)) return;
  for (const c of cookiesToSet) {
    response.cookies.set(c.name, c.value, c.options);
  }
}

async function handleUnauthorized(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized', message: 'Session expired or invalid' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // Redirect to home page where AuthRestoreGuard will attempt to refresh the session client-side
  return NextResponse.redirect(new URL('/', request.url), 303);
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

  // 1. Verify existing tokens
  let adminRes = adminAuth ? await verify(adminAuth.value, jwtSecret) : { payload: null, expired: false };
  let staffRes = staffAuth ? await verify(staffAuth.value, jwtSecret) : { payload: null, expired: false };
  let studentRes = studentAuth ? await verify(studentAuth.value, jwtSecret) : { payload: null, expired: false };

  // Base response
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  let adminPayload = adminRes.payload;
  let staffPayload = staffRes.payload;
  let studentPayload = studentRes.payload;

  // 2. Silent refresh — only for roles that (a) don't have a valid payload and (b) have refresh cookies.
  // Determine which roles need refresh based on current pathname to avoid unnecessary httpxy proxy calls.
  // Each refresh is an internal HTTP round-trip through httpxy/compression; limiting them keeps the
  // ServerResponse close-listener count below Node's default 10 even under concurrent navigation.
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isStaffPath = pathname.startsWith('/staff') || pathname.startsWith('/api/staff');
  const isStudentPath = pathname.startsWith('/student') || pathname.startsWith('/api/student');
  const isHomePath = pathname === '/';

  const needsAdminRefresh =
    !adminPayload &&
    (adminRes.expired || !adminAuth) &&
    (cookies.get('admin_refresh_token') || cookies.get('admin_logged_in')) &&
    (isAdminPath || isHomePath || (!isStaffPath && !isStudentPath));

  const needsStaffRefresh =
    !staffPayload &&
    (staffRes.expired || !staffAuth) &&
    (cookies.get('staff_refresh_token') || cookies.get('staff_logged_in')) &&
    (isStaffPath || isHomePath || (!isAdminPath && !isStudentPath));

  const needsStudentRefresh =
    !studentPayload &&
    (studentRes.expired || !studentAuth) &&
    (cookies.get('student_refresh_token') || cookies.get('student_logged_in')) &&
    (isStudentPath || isHomePath || (!isAdminPath && !isStaffPath));

  // Run needed refreshes in parallel (not sequential) to minimize time window during which
  // multiple ServerResponse close listeners accumulate on any single connection
  const refreshResults = await Promise.all([
    needsAdminRefresh ? trySilentRefresh(request, 'admin', jwtSecret) : Promise.resolve(null),
    needsStaffRefresh ? trySilentRefresh(request, 'staff', jwtSecret) : Promise.resolve(null),
    needsStudentRefresh ? trySilentRefresh(request, 'student', jwtSecret) : Promise.resolve(null),
  ]);

  const [adminRefreshed, staffRefreshed, studentRefreshed] = refreshResults;

  if (adminRefreshed) {
    adminPayload = adminRefreshed.payload;
    applyRefreshedCookies(response, adminRefreshed.cookiesToSet);
  }
  if (staffRefreshed) {
    staffPayload = staffRefreshed.payload;
    applyRefreshedCookies(response, staffRefreshed.cookiesToSet);
  }
  if (studentRefreshed) {
    studentPayload = studentRefreshed.payload;
    applyRefreshedCookies(response, studentRefreshed.cookiesToSet);
  }

  // ─── Route: Home "/" ──────────────────────────────────────────────────────
  if (pathname === '/') {
    // If valid payload exists, immediately redirect to dashboard
    if (adminPayload) return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    if (staffPayload) {
      const dashboard = getDashboardPathByRole(staffPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (studentPayload) {
      return NextResponse.redirect(new URL('/student', request.url), 303);
    }
    return response;
  }

  // ─── Protect API Routes ───────────────────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    if (!adminPayload && !pathname.includes('staff-requests')) return handleUnauthorized(request);
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
    if (pathname === '/admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
  } else if (pathname === '/staff' || pathname.startsWith('/staff/')) {
    // Academic calendar can be accessed by Admin or HOD (Faculty)
    if (pathname.startsWith('/staff/academic-calendar')) {
      if (!adminPayload && !staffPayload) return handleUnauthorized(request);
      if (staffPayload && staffPayload.role !== 'faculty') {
        return NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303);
      }
    } else {
      if (!staffPayload) return handleUnauthorized(request);
      if (pathname === '/staff') {
        const dashboard = getDashboardPathByRole(staffPayload.role);
        return NextResponse.redirect(new URL(dashboard, request.url), 303);
      }
      if (pathname.startsWith('/staff/scholarship') && staffPayload.role !== 'scholarship') return NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303);
      if (pathname.startsWith('/staff/admission') && staffPayload.role !== 'admission') return NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303);
      if (pathname.startsWith('/staff/faculty') && staffPayload.role !== 'faculty') return NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303);
      if (pathname.startsWith('/staff/hod') && (staffPayload.role !== 'faculty' || !staffPayload.is_hod)) return NextResponse.redirect(new URL(getDashboardPathByRole(staffPayload.role), request.url), 303);
    }
  } else if (pathname.startsWith('/student')) {
    if (!studentPayload) return handleUnauthorized(request);
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || pathname === '/student/settings/security' || pathname === '/student/profile';
    if (!isVerified && !allowedForUnverified) return NextResponse.redirect(new URL('/student/settings/security', request.url), 303);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api/auth|api/public|api/dev|api/verify|_next/static|_next/image|favicon.ico|assets|screenshots).*)',
  ],
};
