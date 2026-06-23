import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SignJWT } from 'jose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isDeveloper } from '@/lib/developers';

function resolveBaseRedirect(request) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    return new URL(`${forwardedProto}://${forwardedHost}/`);
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return new URL(process.env.NEXT_PUBLIC_BASE_URL);
  }

  return new URL('/', request.url);
}

async function _buildClerkAuthToken(clerk) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({
    id: clerk.id,
    clerkId: clerk.id,
    email: clerk.email,
    role: clerk.role,
    is_hod: !!clerk.is_hod,
    branch: clerk.branch,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const baseRedirect = resolveBaseRedirect(request);
  if (!globalThis.__google_complete_redirect_logged) {
    globalThis.__google_complete_redirect_logged = true;
    logger.info('[GOOGLE_COMPLETE_REDIRECT]', {
      requestUrl: request.url,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      resolvedBase: baseRedirect.toString(),
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    });
  }

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/?error=NoEmail', baseRedirect), 303);
  }

  // Developer login: redirect to developers page without app auth cookies
  if (isDeveloper(session.user.email)) {
    return NextResponse.redirect(new URL('/developers', baseRedirect), 303);
  }

  const clerk = await db.query.clerks.findFirst({
    where: eq(clerks.email, session.user.email),
    columns: {
      id: true,
      email: true,
      role: true,
      is_active: true,
      is_hod: true,
      branch: true
    }
  });

  if (!clerk || !clerk.is_active) {
    return NextResponse.redirect(baseRedirect, 303);
  }

  const response = NextResponse.redirect(baseRedirect, 303);

  // Clear other auth cookies
  response.cookies.delete('admin_auth');
  response.cookies.delete('student_auth');

  // Use the standard utility to issue 30-day cookies for Google Login
  const { issueClerkAuthCookie } = await import('@/lib/auth-utils');
  await issueClerkAuthCookie(response, clerk, true);

  return response;
}
