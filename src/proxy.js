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
 * Silent Refresh via internal fetch with an AbortController timeout.
 * Returns an array of parsed cookie objects on success, null on failure.
 *
 * NOTE: In Next.js 16 with Turbopack, the middleware's internal fetch
 * goes through the Node.js server's request handler. We set a 5-second
 * timeout to ensure a deadlock cannot hang the browser indefinitely.
 */
async function attemptSilentRefresh(userType, request) {
  const controller = new AbortController();
  // 5-second timeout: prevents deadlock from hanging the browser
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const baseUrl = request.nextUrl.origin;
    const cookieHeader = request.headers.get('cookie') || '';

    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Host': request.nextUrl.host,
        // Signal to the refresh route that this is an internal middleware call
        'X-Internal-Middleware-Refresh': '1',
      },
      body: JSON.stringify({ type: userType }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') {
        const text = await res.text().catch(() => '<no-body>');
        console.error(`[EdgeRefresh][${userType}] ${res.status}: ${text}`);
      }
      return null;
    }

    // Parse the Set-Cookie headers from the refresh API response
    const rawCookies = res.headers.getSetCookie();
    const parsed = rawCookies
      .map(parseSetCookieString)
      .filter(Boolean);

    return parsed.length > 0 ? parsed : null;

  } catch (err) {
    clearTimeout(timer);
    if (process.env.NODE_ENV === 'development') {
      if (err.name === 'AbortError') {
        console.error(`[EdgeRefresh][${userType}] TIMEOUT - internal fetch took >5s (possible deadlock)`);
      } else {
        console.error(`[EdgeRefresh][${userType}] fetch error:`, err.message);
      }
    }
    return null;
  }
}

/**
 * Apply an array of parsed cookie objects to a NextResponse using .cookies.set()
 * This is the correct way in Next.js 16 to set cookies from middleware —
 * it writes to x-middleware-set-cookie so the framework picks them up properly.
 */
function applyCookiesToResponse(response, parsedCookies) {
  for (const { name, value, options } of parsedCookies) {
    response.cookies.set(name, value, options);
  }
}

/**
 * Clear a set of cookies from a NextResponse (expire them).
 */
function clearCookiesFromResponse(response, names) {
  for (const name of names) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';

  // Only attempt refresh if companion cookies confirm a session should exist
  const hasAdminSession = !!cookies.get('admin_logged_in');
  const hasClerkSession = !!cookies.get('clerk_logged_in');
  const hasStudentSession = !!cookies.get('student_logged_in');

  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get('x-request-id') || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  requestHeaders.set('x-request-id', requestId);

  // 1. Verify existing tokens
  let adminRes = adminAuth ? await verify(adminAuth.value, jwtSecret) : { payload: null, expired: false };
  let clerkRes = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : { payload: null, expired: false };
  let studentRes = studentAuth ? await verify(studentAuth.value, jwtSecret) : { payload: null, expired: false };

  // Base response - we'll rebuild this after refresh if needed
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  let refreshTriggered = false;
  // parsedNewCookies stores cookies from a successful refresh to carry over on redirects
  let parsedNewCookies = [];

  // 2. Silent Refresh: admin
  // Trigger if: no valid payload AND (token is missing entirely OR it's expired) AND session marker exists
  if (!adminRes.payload && (!adminAuth || adminRes.expired) && hasAdminSession) {
    const refreshedCookies = await attemptSilentRefresh('admin', request);
    if (refreshedCookies) {
      applyCookiesToResponse(response, refreshedCookies);
      parsedNewCookies = refreshedCookies;

      // Extract the new auth token and verify it so the routing logic below works
      const authCookie = refreshedCookies.find(c => c.name === 'admin_auth');
      if (authCookie) {
        adminRes = await verify(authCookie.value, jwtSecret);
      }
      refreshTriggered = true;
    } else {
      // Refresh failed — purge stale cookies so the browser doesn't get stuck
      clearCookiesFromResponse(response, ['admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id']);
      refreshTriggered = true;
    }
  }

  // 3. Silent Refresh: clerk
  if (!clerkRes.payload && (!clerkAuth || clerkRes.expired) && !refreshTriggered && hasClerkSession) {
    const refreshedCookies = await attemptSilentRefresh('clerk', request);
    if (refreshedCookies) {
      applyCookiesToResponse(response, refreshedCookies);
      parsedNewCookies = refreshedCookies;

      const authCookie = refreshedCookies.find(c => c.name === 'clerk_auth');
      if (authCookie) {
        clerkRes = await verify(authCookie.value, jwtSecret);
      }
      refreshTriggered = true;
    } else {
      clearCookiesFromResponse(response, ['clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role', 'clerk_session_id']);
      refreshTriggered = true;
    }
  }

  // 4. Silent Refresh: student
  if (!studentRes.payload && (!studentAuth || studentRes.expired) && !refreshTriggered && hasStudentSession) {
    const refreshedCookies = await attemptSilentRefresh('student', request);
    if (refreshedCookies) {
      applyCookiesToResponse(response, refreshedCookies);
      parsedNewCookies = refreshedCookies;

      const authCookie = refreshedCookies.find(c => c.name === 'student_auth');
      if (authCookie) {
        studentRes = await verify(authCookie.value, jwtSecret);
      }
      refreshTriggered = true;
    } else {
      clearCookiesFromResponse(response, ['student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id']);
      refreshTriggered = true;
    }
  }

  // Rebuild the response after refresh so updated requestHeaders are applied
  if (refreshTriggered) {
    const oldCookies = response.cookies.getAll();
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    // Re-apply all the cookies using .cookies.set() on the new response
    for (const cookie of oldCookies) {
      response.cookies.set(cookie.name, cookie.value, {
        path: cookie.path || '/',
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        domain: cookie.domain,
      });
    }
  }

  const adminPayload = adminRes.payload;
  const clerkPayload = clerkRes.payload;
  const studentPayload = studentRes.payload;

  /**
   * Carry new cookies over onto a redirect response.
   * Uses .cookies.set() — the only correct API in Next.js 16 middleware.
   */
  const withCookies = (redirectResponse) => {
    if (parsedNewCookies.length > 0) {
      applyCookiesToResponse(redirectResponse, parsedNewCookies);
    }
    return redirectResponse;
  };

  // ─── Route: Home "/" ──────────────────────────────────────────────────────
  if (pathname === '/') {
    if (adminPayload) return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
    if (clerkPayload) {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
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
  } else if (pathname.startsWith('/api/clerk')) {
    if (!clerkPayload) return handleUnauthorized(request);
  }

  // ─── Protect UI Routes ────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
    if (pathname === '/admin') return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
  } else if (pathname.startsWith('/clerk')) {
    if (!clerkPayload) return handleUnauthorized(request);
    if (pathname === '/clerk') {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return withCookies(NextResponse.redirect(new URL(dashboard, request.url), 303));
    }
    if (pathname.startsWith('/clerk/scholarship') && clerkPayload.role !== 'scholarship') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
    if (pathname.startsWith('/clerk/admission') && clerkPayload.role !== 'admission') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
    if (pathname.startsWith('/clerk/faculty') && clerkPayload.role !== 'faculty') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
  } else if (pathname.startsWith('/student')) {
    if (!studentPayload) return handleUnauthorized(request);
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || pathname === '/student/settings/security' || pathname === '/student/profile';
    if (!isVerified && !allowedForUnverified) return withCookies(NextResponse.redirect(new URL('/student', request.url), 303));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api/auth|api/public|api/dev|api/verify|_next/static|_next/image|favicon.ico|assets|screenshots).*)',
  ],
};
