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

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { cookies } = request;

  const adminAuth = cookies.get('admin_auth');
  const clerkAuth = cookies.get('clerk_auth');
  const studentAuth = cookies.get('student_auth');
  const jwtSecret = process.env.JWT_SECRET;

  // If on the login page, do nothing
  if (pathname === '/') {
    // If authenticated, redirect to the appropriate dashboard
    if (adminAuth && (await verify(adminAuth.value, jwtSecret))) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    if (clerkAuth && (await verify(clerkAuth.value, jwtSecret))) {
      const { role } = (await verify(clerkAuth.value, jwtSecret));
      const dashboard = role.includes('scholar') ? '/clerk/scholarship/dashboard' : '/clerk/admission/dashboard';
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
    if (studentAuth && (await verify(studentAuth.value, jwtSecret))) {
      return NextResponse.redirect(new URL('/student/profile', request.url));
    }
    return NextResponse.next();
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!adminAuth || !(await verify(adminAuth.value, jwtSecret))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  // Protect /clerk routes
  else if (pathname.startsWith('/clerk')) {
    if (!clerkAuth || !(await verify(clerkAuth.value, jwtSecret))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    const payload = await verify(clerkAuth.value, jwtSecret);
    if (!payload) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    const { role } = payload;
    if (pathname === '/clerk') {
      const dashboard = role.includes('scholar') ? '/clerk/scholarship/dashboard' : '/clerk/admission/dashboard';
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
  }

  // Protect /student routes
  else if (pathname.startsWith('/student')) {
    if (!studentAuth || !(await verify(studentAuth.value, jwtSecret))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname === '/student') {
      return NextResponse.redirect(new URL('/student/profile', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/clerk/:path*', '/student/:path*'],
};

