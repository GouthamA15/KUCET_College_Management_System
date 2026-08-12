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
 * Returns { cookies: string[], definitelyInvalid: boolean } on completion.
 *
 * - cookies: raw Set-Cookie strings on success, null on failure
 * - definitelyInvalid: true ONLY when the server explicitly rejected the
 *   credentials with a 4xx status code. false on network errors, timeouts,
 *   or 5xx — which are transient and must NOT trigger cookie destruction.
 *
 * NOTE: In Next.js with Turbopack, the middleware's internal fetch goes through
 * the Node.js server's request handler. We set a 5-second timeout to prevent
 * a deadlock from hanging the browser indefinitely.
 */
async function attemptSilentRefresh(userType, request) {
  const controller = new AbortController();
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
      // Only treat 4xx as definitively invalid credentials.
      // 5xx = server/db error — transient, do NOT destroy cookies.
      const definitelyInvalid = res.status >= 400 && res.status < 500;
      return { cookies: null, definitelyInvalid };
    }

    const rawSetCookies = res.headers.getSetCookie();
    return { cookies: rawSetCookies.length > 0 ? rawSetCookies : null, definitelyInvalid: false };

  } catch (err) {
    clearTimeout(timer);
    if (process.env.NODE_ENV === 'development') {
      if (err.name === 'AbortError') {
        console.error(`[EdgeRefresh][${userType}] TIMEOUT - internal fetch took >5s (possible deadlock)`);
      } else {
        console.error(`[EdgeRefresh][${userType}] fetch error:`, err.message);
      }
    }
    // Network error / timeout — transient, do NOT destroy cookies.
    return { cookies: null, definitelyInvalid: false };
  }
}

/**
 * Apply an array of raw Set-Cookie strings to a NextResponse.
 *
 * INVARIANT (Session 205): Each cookie string MUST be appended individually
 * via response.headers.append('set-cookie', str). This is the ONLY correct
 * way to set multiple cookies from Edge middleware without Next.js
 * comma-merging them into a single malformed header.
 *
 * DO NOT use response.cookies.set() for multi-cookie batches.
 */
function applyRawCookiesToResponse(response, rawCookieStrings) {
  for (const str of rawCookieStrings) {
    response.headers.append('set-cookie', str);
  }
}

/**
 * Build raw Set-Cookie expiry strings to purge stale cookies.
 * Uses HTTP 1970 expiration to immediately expire them in the browser.
 */
function buildPurgeCookieStrings(names) {
  return names.map(name => `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
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

  // Base response - built fresh, then cookies applied via raw headers.append()
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  let refreshTriggered = false;

  // INVARIANT (Session 205): newCookiesToSet holds raw Set-Cookie strings.
  // These are appended individually to response headers — never merged.
  // This array is also carried forward onto redirect responses via withCookies().
  let newCookiesToSet = [];

  // 2. Silent Refresh: admin
  if (!adminRes.payload && (!adminAuth || adminRes.expired) && hasAdminSession) {
    const { cookies: rawCookies, definitelyInvalid } = await attemptSilentRefresh('admin', request);
    if (rawCookies) {
      applyRawCookiesToResponse(response, rawCookies);
      newCookiesToSet = rawCookies;
      const authCookieStr = rawCookies.find(s => s.startsWith('admin_auth='));
      if (authCookieStr) {
        const parsed = parseSetCookieString(authCookieStr);
        if (parsed) adminRes = await verify(parsed.value, jwtSecret);
      }
      refreshTriggered = true;
    } else if (definitelyInvalid) {
      // Only purge cookies if server explicitly rejected the credentials (4xx).
      // Do NOT purge on timeouts, network errors, or 5xx — those are transient.
      const purgeStrings = buildPurgeCookieStrings([
        'admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id'
      ]);
      applyRawCookiesToResponse(response, purgeStrings);
      newCookiesToSet = purgeStrings;
      refreshTriggered = true;
    }
    // transient failure: leave cookies intact, let the user's next request retry
  }

  // 3. Silent Refresh: clerk
  if (!clerkRes.payload && (!clerkAuth || clerkRes.expired) && !refreshTriggered && hasClerkSession) {
    const { cookies: rawCookies, definitelyInvalid } = await attemptSilentRefresh('clerk', request);
    if (rawCookies) {
      applyRawCookiesToResponse(response, rawCookies);
      newCookiesToSet = rawCookies;
      const authCookieStr = rawCookies.find(s => s.startsWith('clerk_auth='));
      if (authCookieStr) {
        const parsed = parseSetCookieString(authCookieStr);
        if (parsed) clerkRes = await verify(parsed.value, jwtSecret);
      }
      refreshTriggered = true;
    } else if (definitelyInvalid) {
      const purgeStrings = buildPurgeCookieStrings([
        'clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role', 'clerk_session_id'
      ]);
      applyRawCookiesToResponse(response, purgeStrings);
      newCookiesToSet = purgeStrings;
      refreshTriggered = true;
    }
  }

  // 4. Silent Refresh: student

  if (!studentRes.payload && (!studentAuth || studentRes.expired) && !refreshTriggered && hasStudentSession) {
    const { cookies: rawCookies, definitelyInvalid } = await attemptSilentRefresh('student', request);
    if (rawCookies) {
      applyRawCookiesToResponse(response, rawCookies);
      newCookiesToSet = rawCookies;

      const authCookieStr = rawCookies.find(s => s.startsWith('student_auth='));
      if (authCookieStr) {
        const parsed = parseSetCookieString(authCookieStr);
        if (parsed) studentRes = await verify(parsed.value, jwtSecret);
      }
      refreshTriggered = true;
    } else if (definitelyInvalid) {
      // Only purge cookies if server explicitly rejected the credentials (4xx).
      // Do NOT purge on timeouts, network errors, or 5xx — those are transient.
      const purgeStrings = buildPurgeCookieStrings([
        'student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id'
      ]);
      applyRawCookiesToResponse(response, purgeStrings);
      newCookiesToSet = purgeStrings;
      refreshTriggered = true;
    }
    // transient failure: leave cookies intact, let the user's next request retry
  }

  const adminPayload = adminRes.payload;
  const clerkPayload = clerkRes.payload;
  const studentPayload = studentRes.payload;

  /**
   * Carry new cookies over onto a redirect response.
   *
   * INVARIANT (Session 205): Each cookie string is appended individually via
   * redirectResponse.headers.append('set-cookie', str) — never merged.
   */
  const withCookies = (redirectResponse) => {
    if (newCookiesToSet.length > 0) {
      applyRawCookiesToResponse(redirectResponse, newCookiesToSet);
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
