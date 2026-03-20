import { SignJWT } from 'jose';
import crypto from 'crypto';
import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export function getDashboardPathByRole(role) {
  switch (role) {
    case 'scholarship':
      return '/clerk/scholarship/dashboard';
    case 'admission':
      return '/clerk/admission/dashboard';
    case 'faculty':
      return '/clerk/faculty/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/'; // Fallback for unknown roles or student login
  }
}

/**
 * Generates a refresh token, hashes it, stores it in the DB, and sets it in a cookie.
 */
async function issueRefreshToken(response, userId, userType, rememberMe = false) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  const durationDays = rememberMe ? 30 : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  await db.insert(refreshTokens).values({
    token_hash: tokenHash,
    user_id: String(userId),
    user_type: userType,
    expires_at: expiresAt,
  });

  const cookieName = `${userType}_refresh_token`;
  response.cookies.set(cookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: durationDays * 24 * 60 * 60,
    path: '/',
  });

  return refreshToken;
}

/**
 * Generates a student auth JWT and attaches it to the provided NextResponse.
 */
export async function issueStudentAuthCookie(response, student, rememberMe = false) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  // Short-lived access token (15 mins for better rotation)
  const sessionDuration = '15m';
  const cookieMaxAge = 15 * 60;

  const token = await new SignJWT({
    student_id: student.id || student.student_id,
    roll_no: student.roll_no,
    name: student.name,
    is_email_verified: student.is_email_verified === 1 || student.is_email_verified === true,
    has_password_set: !!(student.password_hash || student.has_password_set),
    role: 'student'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  response.cookies.set('student_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
    path: '/',
  });

  // Issue Refresh Token
  await issueRefreshToken(response, student.roll_no, 'student', rememberMe);

  return response;
}

/**
 * Generates a clerk auth JWT and attaches it to the provided NextResponse.
 */
export async function issueClerkAuthCookie(response, clerk, rememberMe = false) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const sessionDuration = '15m';
  const cookieMaxAge = 15 * 60;

  const token = await new SignJWT({
    id: clerk.id,
    clerkId: clerk.id,
    email: clerk.email,
    role: clerk.role,
    is_hod: !!clerk.is_hod,
    branch: clerk.branch,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  response.cookies.set('clerk_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
    path: '/',
  });

  // Set companion cookies for UI
  response.cookies.set('clerk_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    path: '/',
  });
  response.cookies.set('clerk_role', clerk.role || '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    path: '/',
  });

  // Issue Refresh Token
  await issueRefreshToken(response, clerk.email, 'clerk', rememberMe);

  return response;
}

/**
 * Generates an admin auth JWT and attaches it to the provided NextResponse.
 */
export async function issueAdminAuthCookie(response, admin, rememberMe = false) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const sessionDuration = '15m';
  const cookieMaxAge = 15 * 60;

  const token = await new SignJWT({
    id: admin.id,
    email: admin.email,
    role: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  response.cookies.set('admin_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
    path: '/',
  });

  // Issue Refresh Token
  await issueRefreshToken(response, admin.email, 'admin', rememberMe);

  return response;
}
