import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';

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

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET;

  // Home ("/") is a pure login gate. Authenticated users are redirected server-side.
  if (pathname === '/') {
    const adminPayload = adminAuth ? await verifyJwt(adminAuth.value, jwtSecret) : null;
    if (adminPayload) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    }

    const clerkPayload = clerkAuth ? await verifyJwt(clerkAuth.value, jwtSecret) : null;
    if (clerkPayload) {
      const dashboard = clerkDashboardPath(clerkPayload.role);
      return NextResponse.redirect(new URL(dashboard, request.url), 303);
    }

    const studentPayload = studentAuth ? await verifyJwt(studentAuth.value, jwtSecret) : null;
    if (studentPayload) {
      return NextResponse.redirect(new URL('/student/profile', request.url), 303);
    }

    // Unauthenticated users proceed to Home.
    return NextResponse.next();
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const adminPayload = adminAuth ? await verifyJwt(adminAuth.value, jwtSecret) : null;
    if (!adminPayload) {
      return NextResponse.redirect(new URL('/', request.url), 303);
    }
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url), 303);
    }
  }

  // Protect /clerk routes
  else if (pathname.startsWith('/clerk')) {
    const clerkPayload = clerkAuth ? await verifyJwt(clerkAuth.value, jwtSecret) : null;
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
    const studentPayload = studentAuth ? await verifyJwt(studentAuth.value, jwtSecret) : null;
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
