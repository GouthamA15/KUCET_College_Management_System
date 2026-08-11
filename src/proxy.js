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
    const isDev = process.env.NODE_ENV === 'development';
    const cookieHeader = request.headers.get('cookie');
    // Try origin first (works in most hosts). If that fails (SSL/loopback issues),
    // fall back to local loopback with the configured PORT. This makes silent refresh
    // robust across dev, Render, and Vercel environments.
    const candidates = isDev
      ? [request.nextUrl.origin]
      : [request.nextUrl.origin, `http://127.0.0.1:${process.env.PORT || 10000}`];

    for (const baseUrl of candidates) {
      try {
        const res = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader || '',
            'Host': request.nextUrl.host,
          },
          body: JSON.stringify({ type: userType }),
        });

        if (res.ok) return res;

        // Log non-OK responses for diagnostics in non-prod or when debugging
        if (process.env.NODE_ENV === 'development') {
          const text = await res.text().catch(() => '<no-body>');
          console.error(`[EdgeRefresh][${userType}] ${baseUrl} responded ${res.status}: ${text}`);
        }
      } catch (err) {
        // Try the next candidate, but log the error for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error(`[EdgeRefreshError][${userType}] base=${baseUrl}`, err);
        }
        continue;
      }
    }

    return null;
  } catch (err) {
    // Only log real errors, suppress expected transient ones
    if (process.env.NODE_ENV === 'development') {
      console.error(`[EdgeRefreshError][${userType}]`, err);
    }
    return null;
  }
}

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';

  // Reduce 401 noise: Only attempt refresh if companion cookies suggest a session exists
  const hasAdminSession = cookies.get('admin_logged_in');
  const hasClerkSession = cookies.get('clerk_logged_in');
  const hasStudentSession = cookies.get('student_logged_in');

  // We need to keep track of request headers to pass them to NextResponse.next()
  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get('x-request-id') || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  requestHeaders.set('x-request-id', requestId);

  let refreshTriggered = false;
  let newCookiesToSet = [];

  // 1. Verify Tokens
  let adminRes = adminAuth ? await verify(adminAuth.value, jwtSecret) : { payload: null };
  let clerkRes = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : { payload: null };
  let studentRes = studentAuth ? await verify(studentAuth.value, jwtSecret) : { payload: null };

  // Prepare the base response (which we might replace with a redirect)
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('x-request-id', requestId);

  // 2. Handle Silent Refresh if expired (Only if session likely exists)
  // The access token might be missing entirely if the browser deleted it due to Max-Age.
  // In that case, we still want to attempt a refresh if the companion cookie exists.
  if (!adminRes.payload && (!adminAuth || adminRes.expired) && hasAdminSession) {
    const refreshRes = await attemptSilentRefresh('admin', request);
    if (refreshRes) {
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
          newCookiesToSet.push(cookieStr);
        });

        const tokenCookie = allCookies.find(c => c.startsWith('admin_auth='));
        const newToken = tokenCookie?.split(';')[0].split('=')[1];
        if (newToken) {
          adminRes = await verify(newToken, jwtSecret);
          requestHeaders.set('x-admin-auth', newToken);
        }
        refreshTriggered = true;
      }
    } else {
      // Refresh failed (invalid, expired, or revoked). Clear stale cookies.
      ['admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id'].forEach(name => {
        const str = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        response.headers.append('set-cookie', str);
        newCookiesToSet.push(str);
      });
      refreshTriggered = true;
    }
  }

  if (!clerkRes.payload && (!clerkAuth || clerkRes.expired) && !refreshTriggered && hasClerkSession) {
    const refreshRes = await attemptSilentRefresh('clerk', request);
    if (refreshRes) {
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
          newCookiesToSet.push(cookieStr);
        });

        const tokenCookie = allCookies.find(c => c.startsWith('clerk_auth='));
        const newToken = tokenCookie?.split(';')[0].split('=')[1];
        if (newToken) {
          clerkRes = await verify(newToken, jwtSecret);
          requestHeaders.set('x-clerk-auth', newToken);
        }
        refreshTriggered = true;
      }
    } else {
      // Refresh failed. Clear stale cookies.
      ['clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role', 'clerk_session_id'].forEach(name => {
        const str = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        response.headers.append('set-cookie', str);
        newCookiesToSet.push(str);
      });
      refreshTriggered = true;
    }
  }

  if (!studentRes.payload && (!studentAuth || studentRes.expired) && !refreshTriggered && hasStudentSession) {
    const refreshRes = await attemptSilentRefresh('student', request);
    if (refreshRes) {
      const allCookies = refreshRes.headers.getSetCookie();
      if (allCookies.length > 0) {
        allCookies.forEach(cookieStr => {
          response.headers.append('set-cookie', cookieStr);
          newCookiesToSet.push(cookieStr);
        });

        const tokenCookie = allCookies.find(c => c.startsWith('student_auth='));
        const newToken = tokenCookie?.split(';')[0].split('=')[1];
        if (newToken) {
          studentRes = await verify(newToken, jwtSecret);
          requestHeaders.set('x-student-auth', newToken);
        }
        refreshTriggered = true;
      }
    } else {
      // Refresh failed. Clear stale cookies.
      ['student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id'].forEach(name => {
        const str = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        response.headers.append('set-cookie', str);
        newCookiesToSet.push(str);
      });
      refreshTriggered = true;
    }
  }

  // Re-create response if headers changed
  if (refreshTriggered) {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    // Apply cookies directly from array, bypassing Next.js header getter crashes
    newCookiesToSet.forEach(cookieStr => {
      response.headers.append('set-cookie', cookieStr);
    });
  }

  const adminPayload = adminRes.payload;
  const clerkPayload = clerkRes.payload;
  const studentPayload = studentRes.payload;

  // Helper to ensure cookies are carried over on redirects
  const withCookies = (redirectResponse) => {
    if (refreshTriggered) {
      newCookiesToSet.forEach(cookieStr => {
        redirectResponse.headers.append('set-cookie', cookieStr);
      });
    }
    return redirectResponse;
  };

  // Home ("/") Logic
  if (pathname === '/') {
    if (adminPayload) return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
    if (clerkPayload) {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return withCookies(NextResponse.redirect(new URL(dashboard, request.url), 303));
    }
    if (studentPayload) {
      // Always redirect to the main student dashboard first.
      // The client-side StudentProvider will handle routing to /profile if needed.
      return withCookies(NextResponse.redirect(new URL('/student', request.url), 303));
    }
    return response;
  }

  // Protect API Routes (Baseline Defense-in-Depth)
  if (pathname.startsWith('/api/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
  }
  else if (pathname.startsWith('/api/clerk')) {
    if (!clerkPayload) return handleUnauthorized(request);
  }

  // Protect UI Routes
  if (pathname.startsWith('/admin')) {
    if (!adminPayload) return handleUnauthorized(request);
    if (pathname === '/admin') return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url), 303));
  }
  else if (pathname.startsWith('/clerk')) {
    if (!clerkPayload) return handleUnauthorized(request);
    if (pathname === '/clerk') {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return withCookies(NextResponse.redirect(new URL(dashboard, request.url), 303));
    }
    // Role checks...
    if (pathname.startsWith('/clerk/scholarship') && clerkPayload.role !== 'scholarship') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
    if (pathname.startsWith('/clerk/admission') && clerkPayload.role !== 'admission') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
    if (pathname.startsWith('/clerk/faculty') && clerkPayload.role !== 'faculty') return withCookies(NextResponse.redirect(new URL(getDashboardPathByRole(clerkPayload.role), request.url), 303));
  }
  else if (pathname.startsWith('/student')) {
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
