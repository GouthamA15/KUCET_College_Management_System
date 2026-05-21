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
  
  return NextResponse.redirect(new URL('/', request.url), 303);
}

/**
 * Silent Refresh Helper for Middleware (Edge)
 * Calls the /api/auth/refresh internal endpoint
 */
async function attemptSilentRefresh(userType, request) {
  try {
    const baseUrl = request.nextUrl.origin;
    const cookieHeader = request.headers.get('cookie');

    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookieHeader || '' 
      },
      body: JSON.stringify({ type: userType }),
    });

    if (res.ok) {
      // The refresh API sets cookies on its response. 
      // We need to extract them and pass them back to our proxy response.
      return res;
    }
    return null;
  } catch (err) {
    console.error(`[EdgeRefreshError][${userType}]`, err);
    return null;
  }
}

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET;

  let response = NextResponse.next();
  let refreshTriggered = false;

  // 1. Verify Tokens
  let adminRes = adminAuth ? await verify(adminAuth.value, jwtSecret) : { payload: null };
  let clerkRes = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : { payload: null };
  let studentRes = studentAuth ? await verify(studentAuth.value, jwtSecret) : { payload: null };

  // 2. Handle Silent Refresh if expired
  if (!adminRes.payload && adminRes.expired) {
    const refreshRes = await attemptSilentRefresh('admin', request);
    if (refreshRes) {
      // PROPER COOKIE PROPAGATION: Use getSetCookie() to get ALL cookies (auth + refresh + UI)
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
        });

        // Use the built-in .cookies helper for reliable extraction
        const newToken = refreshRes.cookies.get('admin_auth')?.value;
        if (newToken) adminRes = await verify(newToken, jwtSecret);
        refreshTriggered = true;
      }
    }
  }

  if (!clerkRes.payload && clerkRes.expired && !refreshTriggered) {
    const refreshRes = await attemptSilentRefresh('clerk', request);
    if (refreshRes) {
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
        });

        const newToken = refreshRes.cookies.get('clerk_auth')?.value;
        if (newToken) clerkRes = await verify(newToken, jwtSecret);
        refreshTriggered = true;
      }
    }
  }

  if (!studentRes.payload && studentRes.expired && !refreshTriggered) {
    const refreshRes = await attemptSilentRefresh('student', request);
    if (refreshRes) {
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
        });

        const newToken = refreshRes.cookies.get('student_auth')?.value;
        if (newToken) studentRes = await verify(newToken, jwtSecret);
        refreshTriggered = true;
      }
    }
  }

  const adminPayload = adminRes.payload;
  const clerkPayload = clerkRes.payload;
  const studentPayload = studentRes.payload;

  // Home ("/") Logic
  if (pathname === '/') {
    if (adminPayload) return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    if (clerkPayload) {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (studentPayload) {
      // Always redirect to the main student dashboard first.
      // The client-side StudentProvider will handle routing to /profile if needed.
      return NextResponse.redirect(new URL('/student', request.url), 303);
    }
    return response;
  }

  // Protect Routes
  if (pathname.startsWith('/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
    if (pathname === '/admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
  }
  else if (pathname.startsWith('/clerk')) {
    if (!clerkPayload) return handleUnauthorized(request);
    if (pathname === '/clerk') {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    // Role checks...
    if (pathname.startsWith('/clerk/scholarship') && clerkPayload.role !== 'scholarship') return NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303);
    if (pathname.startsWith('/clerk/admission') && clerkPayload.role !== 'admission') return NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303);
    if (pathname.startsWith('/clerk/faculty') && clerkPayload.role !== 'faculty') return NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303);
  }
  else if (pathname.startsWith('/student')) {
    if (!studentPayload) return handleUnauthorized(request);
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || pathname === '/student/settings/security' || pathname === '/student/profile';
    if (!isVerified && !allowedForUnverified) return NextResponse.redirect(new URL('/student', request.url), 303);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|assets|screenshots).*)',
  ],
};
