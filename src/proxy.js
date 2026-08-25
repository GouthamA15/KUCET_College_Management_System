import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDashboardPathByRole } from '@/lib/path-utils';

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
  const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';

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

  const adminPayload = adminRes.payload;
  const staffPayload = staffRes.payload;
  const studentPayload = studentRes.payload;

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
    // If payload is null/expired, we let it fall through.
    // The root page will render, and AuthRestoreGuard will pick up the client-side refresh 
    // if companion cookies (_logged_in) exist.
    return response;
  }

  // ─── Protect API Routes ───────────────────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
  } else if (pathname.startsWith('/api/staff')) {
    if (!staffPayload) return handleUnauthorized(request);
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
    }
  } else if (pathname.startsWith('/student')) {
    if (!studentPayload) return handleUnauthorized(request);
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || pathname === '/student/settings/security' || pathname === '/student/profile';
    if (!isVerified && !allowedForUnverified) return NextResponse.redirect(new URL('/student', request.url), 303);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api/auth|api/public|api/dev|api/verify|_next/static|_next/image|favicon.ico|assets|screenshots).*)',
  ],
};
