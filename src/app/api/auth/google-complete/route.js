import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SignJWT } from 'jose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

async function buildClerkAuthToken(clerk) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({
    id: clerk.id,
    clerkId: clerk.id,
    email: clerk.email,
    role: clerk.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const baseRedirect = new URL('/', request.url);

  if (!session?.user?.email) {
    return NextResponse.redirect(baseRedirect, 303);
  }

  const rows = await query(
    'SELECT id, email, role, is_active FROM clerks WHERE email = ?',
    [session.user.email]
  );

  if (!rows.length || !rows[0].is_active) {
    return NextResponse.redirect(baseRedirect, 303);
  }

  const clerk = rows[0];
  const token = await buildClerkAuthToken(clerk);
  const response = NextResponse.redirect(baseRedirect, 303);

  // Clear other auth cookies
  response.cookies.delete('admin_auth');
  response.cookies.delete('student_auth');

  response.cookies.set('clerk_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  });
  response.cookies.set('clerk_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  });
  response.cookies.set('clerk_role', clerk.role || '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  });

  return response;
}
