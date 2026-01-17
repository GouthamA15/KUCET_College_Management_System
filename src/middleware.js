import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protect Admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminAuthCookie = request.cookies.get('admin_auth');
    const token = adminAuthCookie ? adminAuthCookie.value : null;

    if (!token) {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    if (!decoded || decoded.role !== 'super_admin') {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect Clerk routes
  if (pathname.startsWith('/clerk/')) {
    const clerkAuthCookie = request.cookies.get('clerk_auth');
    const token = clerkAuthCookie ? clerkAuthCookie.value : null;

    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    if (!decoded) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const { role } = decoded;
    const requestedDashboard = pathname.split('/')[2];

    if (requestedDashboard !== role) {
      return NextResponse.redirect(new URL(`/clerk/${role}/dashboard`, request.url));
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/clerk/admission/dashboard/:path*', '/clerk/scholarship/dashboard/:path*', '/student/profile/:path*'],
};
