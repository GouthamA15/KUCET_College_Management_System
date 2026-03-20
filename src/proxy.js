import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDashboardPathByRole } from '@/lib/path-utils';

async function verify(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

async function handleUnauthorized(request) {
  const { pathname } = request.nextUrl;
  
  // If it's an API request, return 401 JSON instead of redirecting to HTML login
  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized', message: 'Session expired or invalid' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }
  
  // For page requests, redirect to home/login
  return NextResponse.redirect(new URL('/', request.url), 303);
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET;

  // Home ("/") is a pure login gate. Authenticated users are redirected server-side.
  if (pathname === '/') {
    const adminPayload = adminAuth ? await verify(adminAuth.value, jwtSecret) : null;
    if (adminPayload) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    }

    const clerkPayload = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : null;
    if (clerkPayload) {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }

    const studentPayload = studentAuth ? await verify(studentAuth.value, jwtSecret) : null;
    if (studentPayload) {
      const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
      const target = isVerified ? '/student/profile' : '/student';
      return NextResponse.redirect(new URL(target, request.url), 303);
    }

    // Unauthenticated users proceed to Home.
    return NextResponse.next();
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const adminPayload = adminAuth ? await verify(adminAuth.value, jwtSecret) : null;
    if (!adminPayload) {
      return handleUnauthorized(request);
    }
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    }
  }

  // Protect /clerk routes
  else if (pathname.startsWith('/clerk')) {
    const clerkPayload = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : null;
    if (!clerkPayload) {
      return handleUnauthorized(request);
    }
    if (pathname === '/clerk') {
      const dashboard = getDashboardPathByRole(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    // Enforce role-based access for clerk subpaths via server-only redirects
    if (pathname.startsWith('/clerk/scholarship') && clerkPayload.role !== 'scholarship') {
        const dashboard = getDashboardPathByRole(clerkPayload.role);
        return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (pathname.startsWith('/clerk/admission') && clerkPayload.role !== 'admission') {
        const dashboard = getDashboardPathByRole(clerkPayload.role);
        return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (pathname.startsWith('/clerk/faculty') && clerkPayload.role !== 'faculty') {
        const dashboard = getDashboardPathByRole(clerkPayload.role);
        return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
  }

  // Protect /student routes
  else if (pathname.startsWith('/student')) {
    const studentPayload = studentAuth ? await verify(studentAuth.value, jwtSecret) : null;
    if (!studentPayload) {
      return handleUnauthorized(request);
    }

    // Restriction for unverified students: Only allow HOME, SECURITY, and PROFILE page
    const isVerified = studentPayload.is_email_verified && studentPayload.has_password_set;
    const allowedForUnverified = pathname === '/student' || 
                               pathname === '/student/settings/security' || 
                               pathname === '/student/profile';

    if (!isVerified && !allowedForUnverified) {
      return NextResponse.redirect(new URL('/student', request.url), 303);
    }

    // Keep /student as student home page, no automatic profile redirect.
    if (pathname === '/student') {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|assets|screenshots).*)',
  ],
};
