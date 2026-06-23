import { SignJWT, _jwtVerify } from 'jose';
import crypto from 'crypto';
import { db } from '@/db';
import { refreshTokens, students, clerks, principal } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Generates a refresh token, hashes it, stores it in the DB, and sets it in a cookie.
 */
async function issueRefreshToken(response, userId, userType, rememberMe = false, ip = null, userAgent = null) {
  const { getNow } = await import('./clock');
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  // Normal login: 14 days, Remember Me: 30 days
  const durationDays = rememberMe ? 30 : 14;
  const now = getNow();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    token_hash: tokenHash,
    user_id: String(userId),
    user_type: userType,
    expires_at: expiresAt,
    created_at: now,
  });

  const cookieName = `${userType}_refresh_token`;
  response.cookies.set(cookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: durationDays * 24 * 60 * 60,
    path: '/',
  });

  // Register or Update session if tracking info provided
  if (ip && userAgent) {
    try {
      const SecurityService = (await import('@/services/SecurityService')).default;
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const sessionCookieName = `${userType}_session_id`;
      const existingSessionId = cookieStore.get(sessionCookieName)?.value;

      // We need the numeric DB ID for user_sessions
      let dbId;
      if (userType === 'student') {
        const student = await db.query.students.findFirst({ where: eq(students.roll_no, userId), columns: { id: true } });
        dbId = student?.id;
      } else if (userType === 'clerk') {
        const clerk = await db.query.clerks.findFirst({ where: eq(clerks.email, userId), columns: { id: true } });
        dbId = clerk?.id;
      } else if (userType === 'admin') {
        const admin = await db.query.principal.findFirst({ where: eq(principal.email, userId), columns: { id: true } });
        dbId = admin?.id;
      }

      if (dbId) {
        let sessionId;
        if (existingSessionId) {
          // Update existing session
          const updated = await SecurityService.updateSession({
            sessionId: parseInt(existingSessionId),
            newToken: refreshToken,
            ipAddress: ip,
            userAgent: userAgent,
            expiresAt: expiresAt,
            userId: dbId,
            userType: userType
          });
          if (updated) {
            sessionId = typeof updated === 'number' ? updated : existingSessionId;
          }
        }

        // Fallback to register new if update failed or didn't exist
        if (!sessionId) {
          sessionId = await SecurityService.registerSession({
            userType: userType.toUpperCase(),
            userId: dbId,
            sessionToken: refreshToken,
            ipAddress: ip,
            userAgent: userAgent,
            expiresAt: expiresAt
          });
        }

        if (sessionId) {
          response.cookies.set(sessionCookieName, sessionId.toString(), {
            httpOnly: false, // Accessible by client for realtime revocation check
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: durationDays * 24 * 60 * 60,
            path: '/',
          });
          // Clean up legacy non-role-specific cookie if present
          if (cookieStore.has('session_id')) {
            response.cookies.delete('session_id');
          }
        }
      }
    } catch (err) {
      console.error('Session management failed:', err);
    }
  }

  return refreshToken;
}

/**
 * Generates a student auth JWT and attaches it to the provided NextResponse.
 */
export async function issueStudentAuthCookie(response, student, rememberMe = false, ip = null, userAgent = null) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

  const token = await new SignJWT({
    student_id: student.id || student.student_id,
    roll_no: student.roll_no,
    name: student.name,
    is_email_verified: student.is_email_verified === 1 || student.is_email_verified === true,
    has_password_set: !!(student.password_hash || student.has_password_set),
    role: 'student',
    academic_offset_years: student.academic_offset_years || 0
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

  // Set companion cookies for UI (Must match refresh token duration)
  response.cookies.set('student_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge,
    path: '/',
  });

  // Issue Refresh Token
  await issueRefreshToken(response, student.roll_no, 'student', rememberMe, ip, userAgent);

  return response;
}

/**
 * Generates a clerk auth JWT and attaches it to the provided NextResponse.
 */
export async function issueClerkAuthCookie(response, clerk, rememberMe = false, ip = null, userAgent = null) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

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
  await issueRefreshToken(response, clerk.email, 'clerk', rememberMe, ip, userAgent);

  return response;
}

/**
 * Generates an admin auth JWT and attaches it to the provided NextResponse.
 */
export async function issueAdminAuthCookie(response, admin, rememberMe = false, ip = null, userAgent = null) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

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

  // Companion cookie
  response.cookies.set('admin_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge,
    path: '/',
  });

  // Issue Refresh Token
  await issueRefreshToken(response, admin.email, 'admin', rememberMe, ip, userAgent);

  return response;
}

/**
 * Attempts to refresh the access token using the refresh token from cookies.
 * This is used by the middleware (proxy.js) for silent rotation.
 */
export async function refreshAccessToken(response, userType, cookies, ip = null, userAgent = null) {
  try {
    const { getNow } = await import('./clock');
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

    const now = getNow();
    if (!tokenRecord || tokenRecord.revoked_at || new Date(tokenRecord.expires_at) < now) {
      return null;
    }

    // 2. Revoke old token
    await db.update(refreshTokens)
      .set({ revoked_at: now })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // 3. Fetch user and issue new tokens
    if (userType === 'student') {
      const user = await db.query.students.findFirst({ where: eq(students.roll_no, tokenRecord.user_id) });
      if (!user) return null;
      await issueStudentAuthCookie(response, user, true, ip, userAgent);
      return user;
    } else if (userType === 'clerk') {
      const user = await db.query.clerks.findFirst({ where: eq(clerks.email, tokenRecord.user_id) });
      if (!user || !user.is_active) return null;
      await issueClerkAuthCookie(response, user, true, ip, userAgent);
      return user;
    } else if (userType === 'admin') {
      const user = await db.query.principal.findFirst({ where: eq(principal.email, tokenRecord.user_id) });
      if (!user) return null;
      await issueAdminAuthCookie(response, user, true, ip, userAgent);
      return user;
    }

    return null;
  } catch (error) {
    console.error(`[SilentRefreshError][${userType}]`, error);
    return null;
  }
}
