import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

function clerkDashboardPath(role) {
  switch (role) {
    case 'scholarship':
      return '/clerk/scholarship/dashboard';
    case 'admission':
      return '/clerk/admission/dashboard';
    case 'faculty':
      return '/clerk/faculty/dashboard';
    default:
      return '/';
  }
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
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }

    const studentPayload = studentAuth ? await verify(studentAuth.value, jwtSecret) : null;
    if (studentPayload) {
      return NextResponse.redirect(new URL('/student/profile', request.url), 303);
    }

    // Unauthenticated users proceed to Home.
    return NextResponse.next();
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const adminPayload = adminAuth ? await verify(adminAuth.value, jwtSecret) : null;
    if (!adminPayload) {
      return NextResponse.redirect(new URL('/', request.url), 303);
    }
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    }
  }

  // Protect /clerk routes
  else if (pathname.startsWith('/clerk')) {
    const clerkPayload = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : null;
    if (!clerkPayload) {
      return NextResponse.redirect(new URL('/', request.url), 303);
    }
    if (pathname === '/clerk') {
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    // Enforce role-based access for clerk subpaths via server-only redirects
    if (pathname.startsWith('/clerk/scholarship') && clerkPayload.role !== 'scholarship') {
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (pathname.startsWith('/clerk/admission') && clerkPayload.role !== 'admission') {
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
    if (pathname.startsWith('/clerk/faculty') && clerkPayload.role !== 'faculty') {
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }
  }

  // Protect /student routes
  else if (pathname.startsWith('/student')) {
    const studentPayload = studentAuth ? await verify(studentAuth.value, jwtSecret) : null;
    if (!studentPayload) {
      return NextResponse.redirect(new URL('/', request.url), 303);
    }
    if (pathname === '/student') {
      return NextResponse.redirect(new URL('/student/profile', request.url), 303);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/clerk/:path*', '/student/:path*'],
};

