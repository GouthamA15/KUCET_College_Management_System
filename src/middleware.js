import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protect the clerk dashboard route
  if (pathname.startsWith('/clerk/dashboard')) {
    const authCookie = request.cookies.get('clerk_auth');
    if (!authCookie || authCookie.value !== 'true') {
      // Redirect to the login page if not authenticated
      const loginUrl = new URL('/clerk/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect the student profile route
  if (pathname.startsWith('/student/profile')) {
    const authCookie = request.cookies.get('student_auth');
    if (!authCookie || authCookie.value !== 'true') {
      // Redirect to the home page to use the login panel if not authenticated
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect the admin dashboard route
  if (pathname.startsWith('/admin/dashboard')) {
    const authCookie = request.cookies.get('admin_auth');
    if (!authCookie || authCookie.value !== 'true') {
      // Redirect to the login page if not authenticated
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/clerk/dashboard/:path*', '/student/profile/:path*', '/admin/dashboard/:path*'],
};
