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

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  
  // Redirect root paths to their dashboards
  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }


  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/clerk/:path*', '/student/:path*'],
};
