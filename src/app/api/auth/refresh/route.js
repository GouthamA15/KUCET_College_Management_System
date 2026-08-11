import logger from '@/lib/logger';
import { db } from '@/db';
import { refreshTokens, students, clerks, principal, userSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { 
  issueStudentAuthCookie, 
  issueClerkAuthCookie, 
  issueAdminAuthCookie,
  getJwtSecretKey
} from '@/lib/auth-utils';
import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';

export async function POST(req) {
  // Task 2: Initialize instrumentation variables
  let sessionCookieId = null;
  let dbSessionId = null;
  let userId = null;
  let userType = null;
  let isCurrent = null;
  let isRevoked = null;
  let expiresAt = null;
  let refreshTokenPresent = false;
  let refreshTokenHashMatches = false;
  let ownershipValidationResult = null;
  let roleValidationResult = null;
  let jwtGenerationReached = false;
  let refreshRotationReached = false;

  const logDevValues = () => {
    if (process.env.NODE_ENV === 'development') {
      logger.info({
        sessionCookieId,
        dbSessionId,
        userId,
        userType,
        isCurrent,
        isRevoked,
        expiresAt,
        refreshTokenPresent,
        refreshTokenHashMatches,
        ownershipValidationResult,
        roleValidationResult,
        jwtGenerationReached,
        refreshRotationReached
      }, '[AUTH_REFRESH_DIAGNOSTIC]');
    }
  };

  try {
    const { type } = await req.json(); // 'student', 'clerk', or 'admin'
    userType = type;

    if (!['student', 'clerk', 'admin'].includes(type)) {
      logDevValues();
      return apiError('Invalid user type', 400);
    }

    const cookieStore = await cookies();

    // Task 4: Ensure cookies read role-specific session and refresh tokens, no legacy session_id
    const sessionCookieName = `${type}_session_id`;
    const refreshCookieName = `${type}_refresh_token`;
    const authCookieName = `${type}_auth`;

    const sessionCookieVal = cookieStore.get(sessionCookieName)?.value;
    sessionCookieId = sessionCookieVal ? parseInt(sessionCookieVal, 10) : null;

    const refreshToken = cookieStore.get(refreshCookieName)?.value;
    refreshTokenPresent = !!refreshToken;

    if (!refreshToken) {
      logDevValues();
      return apiError('Refresh token missing', 401);
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // 1. Find the token in DB
    const tokenRecord = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.token_hash, tokenHash),
        eq(refreshTokens.user_type, type)
      )
    });

    refreshTokenHashMatches = !!tokenRecord;
    if (!tokenRecord) {
      logDevValues();
      return apiError('Invalid refresh token', 401);
    }

    userId = tokenRecord.user_id;
    expiresAt = tokenRecord.expires_at;

    // Task 5: Verify Session Lookup (always load user_sessions.id == student_session_id / clerk_session_id / admin_session_id cookie)
    let sessionRecord = null;
    if (type !== 'student' && sessionCookieId) {
      sessionRecord = await db.query.userSessions.findFirst({
        where: eq(userSessions.id, sessionCookieId)
      });
      if (sessionRecord) {
        dbSessionId = sessionRecord.id;
        isCurrent = sessionRecord.is_current === true || sessionRecord.is_current === 1;
        isRevoked = sessionRecord.is_revoked === true || sessionRecord.is_revoked === 1;
      }
    }

    // Task 5: Log both sessionCookieId and dbSessionId values
    logger.info({ sessionCookieId, dbSessionId }, '[AUTH_REFRESH_SESSION_LOOKUP]');

    // Validate that the session is active and not revoked
    if (sessionRecord && sessionRecord.is_revoked) {
      logDevValues();
      return apiError('Your session has been revoked. Please login again.', 401);
    }

    const now = (await import('@/lib/clock')).getNow();

    if (sessionRecord && new Date(sessionRecord.expires_at) < now) {
      logDevValues();
      return apiError('Session expired. Please login again.', 401);
    }

    // Decode JWT from auth cookie to compare roles
    const authToken = cookieStore.get(authCookieName)?.value;
    let jwtPayload = null;
    if (authToken) {
      try {
        jwtPayload = decodeJwt(authToken);
      } catch (_err) {
        // Suppress parsing errors on expired / malformed JWTs during refresh
      }
    }

    // Task 3: Verify Hash Rotation / Stale Hash / Grace Period
    if (tokenRecord.revoked_at) {
      const revokedAtTime = new Date(tokenRecord.revoked_at).getTime();
      const gracePeriodMs = 15000; // 15 seconds grace period for concurrent requests
      const isWithinGracePeriod = (now.getTime() - revokedAtTime) < gracePeriodMs;

      if (isWithinGracePeriod) {
        // This is a concurrent request within the grace period.
        // Instead of failing and revoking everything, we return a fresh access token (JWT)
        // and keep the same refresh token cookie (do not rotate again).
        
        // Fetch user for validation
        let user = null;
        if (type === 'student') {
          user = await db.query.students.findFirst({ where: eq(students.roll_no, tokenRecord.user_id) });
        } else if (type === 'clerk') {
          user = await db.query.clerks.findFirst({ where: eq(clerks.email, tokenRecord.user_id) });
        } else if (type === 'admin') {
          user = await db.query.principal.findFirst({ where: eq(principal.email, tokenRecord.user_id) });
        }

        if (!user) {
          logDevValues();
          return apiError('User not found', 401);
        }

        if (type === 'clerk' && !user.is_active) {
          logDevValues();
          return apiError('User not found or inactive', 401);
        }

        // Task 6: Ownership validation
        if (type === 'student') {
          ownershipValidationResult = (tokenRecord.user_id === user.roll_no);
        } else {
          ownershipValidationResult = (tokenRecord.user_id === user.email);
        }

        // Task 6: Role validation (cookie role -> db role -> JWT role -> refresh token owner)
        let cookieRole = null;
        if (type === 'student') {
          cookieRole = 'student';
        } else if (type === 'clerk') {
          cookieRole = cookieStore.get('clerk_role')?.value;
        } else if (type === 'admin') {
          cookieRole = 'admin';
        }

        const dbRole = type === 'clerk' ? user.role : type;
        const jwtRole = jwtPayload?.role;
        roleValidationResult = (cookieRole === dbRole && (!jwtRole || jwtRole === dbRole));

        if (!ownershipValidationResult || !roleValidationResult) {
          logDevValues();
          return apiError('Security validation failed', 401);
        }

        // Issue new access token only
        const response = apiResponse({ success: true, message: 'Token refreshed (grace period)' });
        const secret = typeof getJwtSecretKey === 'function' ? getJwtSecretKey() : new TextEncoder().encode(process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long');
        const sessionDuration = '15m';
        const cookieMaxAge = (cookieStore.get(`${type}_logged_in`)?.value === 'true' ? 30 : 14) * 24 * 60 * 60;

        if (type === 'student') {
          const token = await new (await import('jose')).SignJWT({
            student_id: user.id || user.student_id,
            roll_no: user.roll_no,
            name: user.name,
            is_email_verified: user.is_email_verified === 1 || user.is_email_verified === true,
            has_password_set: !!(user.password_hash || user.has_password_set),
            role: 'student',
            academic_offset_years: user.academic_offset_years || 0
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
        } else if (type === 'clerk') {
          const token = await new (await import('jose')).SignJWT({
            id: user.id,
            clerkId: user.id,
            email: user.email,
            role: user.role,
            is_hod: !!user.is_hod,
            branch: user.branch,
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
        } else if (type === 'admin') {
          const token = await new (await import('jose')).SignJWT({
            id: user.id,
            email: user.email,
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
        }

        jwtGenerationReached = true;
        return response;
      }

      // If outside the grace period, it's a security violation (theft detection).
      // Revoke all active tokens for this user as a precaution.
      // We must explicitly use SQL to only update tokens where revoked_at IS NULL,
      // otherwise we reset the clock on the current token and inadvertently
      // trigger the grace period for subsequent requests!
      const { sql } = await import('drizzle-orm');
      await db.update(refreshTokens)
        .set({ revoked_at: now })
        .where(and(
            eq(refreshTokens.user_id, tokenRecord.user_id),
            eq(refreshTokens.user_type, type),
            sql`${refreshTokens.revoked_at} IS NULL`
        ));
      logDevValues();
      return apiError('Token revoked. Please login again.', 401);
    }

    // 4. Check if expired
    if (new Date(tokenRecord.expires_at) < now) {
      logDevValues();
      return apiError('Refresh token expired', 401);
    }

    // Fetch user for validation and generation
    let user = null;
    if (type === 'student') {
      user = await db.query.students.findFirst({ where: eq(students.roll_no, tokenRecord.user_id) });
    } else if (type === 'clerk') {
      user = await db.query.clerks.findFirst({ where: eq(clerks.email, tokenRecord.user_id) });
    } else if (type === 'admin') {
      user = await db.query.principal.findFirst({ where: eq(principal.email, tokenRecord.user_id) });
    }

    if (!user) {
      logDevValues();
      return apiError('User not found', 401);
    }

    if (type === 'clerk' && !user.is_active) {
      logDevValues();
      return apiError('User not found or inactive', 401);
    }

    // Task 6: Ownership validation
    if (type === 'student') {
      ownershipValidationResult = (tokenRecord.user_id === user.roll_no);
    } else {
      ownershipValidationResult = (tokenRecord.user_id === user.email);
    }

    // Task 6: Role validation (cookie role -> db role -> JWT role -> refresh token owner)
    let cookieRole = null;
    if (type === 'student') {
      cookieRole = 'student';
    } else if (type === 'clerk') {
      cookieRole = cookieStore.get('clerk_role')?.value;
    } else if (type === 'admin') {
      cookieRole = 'admin';
    }

    const dbRole = type === 'clerk' ? user.role : type;
    const jwtRole = jwtPayload?.role;
    roleValidationResult = (cookieRole === dbRole && (!jwtRole || jwtRole === dbRole));

    if (!ownershipValidationResult || !roleValidationResult) {
      logDevValues();
      return apiError('Security validation failed', 401);
    }

    // 5. Revoke old token
    await db.update(refreshTokens)
      .set({ revoked_at: now })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // 6. Fetch user and issue new tokens
    const response = apiResponse({ success: true, message: 'Token refreshed' });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    refreshRotationReached = true;
    jwtGenerationReached = true;

    if (type === 'student') {
      await issueStudentAuthCookie(response, user, true, ip, userAgent);
    } else if (type === 'clerk') {
      await issueClerkAuthCookie(response, user, true, ip, userAgent);
    } else if (type === 'admin') {
      await issueAdminAuthCookie(response, user, true, ip, userAgent);
    }

    return response;

  } catch (error) {
    logger.error('[AUTH_REFRESH_ERROR]', error);
    logDevValues();
    return apiError('Internal Server Error', 500);
  }
}
