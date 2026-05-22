import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { db } from '@/db';
import { refreshTokens, students, clerks, principal } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Generates a refresh token, hashes it, stores it in the DB, and sets it in a cookie.
 */
async function issueRefreshToken(response, userId, userType, rememberMe = false) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  // Normal login: 14 days, Remember Me: 30 days
  const durationDays = rememberMe ? 30 : 14;
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
  // Access token: 15 minutes. Refresh token: 7-30 days
  const sessionDuration = '15m';
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

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

  // Set companion cookies for UI
  response.cookies.set('student_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
  // Access token: 15 minutes. Refresh token: 7-30 days
  const sessionDuration = '15m';
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

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
    maxAge: cookieMaxAge,
    path: '/',
  });
  response.cookies.set('clerk_role', clerk.role || '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge,
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
  // Access token: 15 minutes. Refresh token: 7-30 days
  const sessionDuration = '15m';
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

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

/**
 * Attempts to refresh the access token using the refresh token from cookies.
 * This is used by the middleware (proxy.js) for silent rotation.
 */
export async function refreshAccessToken(response, userType, cookies) {
  try {
    const refreshToken = cookies.get(`${userType}_refresh_token`)?.value;
    if (!refreshToken) return null;

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // 1. Find the token in DB
    const tokenRecord = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.token_hash, tokenHash),
        eq(refreshTokens.user_type, userType)
      )
    });

    if (!tokenRecord || tokenRecord.revoked_at || new Date(tokenRecord.expires_at) < new Date()) {
      return null;
    }

    // 2. Revoke old token
    await db.update(refreshTokens)
      .set({ revoked_at: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // 3. Fetch user and issue new tokens
    if (userType === 'student') {
      const user = await db.query.students.findFirst({ where: eq(students.roll_no, tokenRecord.user_id) });
      if (!user) return null;
      await issueStudentAuthCookie(response, user, true);
      return user;
    } else if (userType === 'clerk') {
      const user = await db.query.clerks.findFirst({ where: eq(clerks.email, tokenRecord.user_id) });
      if (!user || !user.is_active) return null;
      await issueClerkAuthCookie(response, user, true);
      return user;
    } else if (userType === 'admin') {
      const user = await db.query.principal.findFirst({ where: eq(principal.email, tokenRecord.user_id) });
      if (!user) return null;
      await issueAdminAuthCookie(response, user, true);
      return user;
    }

    return null;
  } catch (error) {
    console.error(`[SilentRefreshError][${userType}]`, error);
    return null;
  }
}
