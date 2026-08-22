import { SignJWT, _jwtVerify } from 'jose';
import crypto from 'crypto';
import { db } from '@/db';
import { refreshTokens, students, staffAccounts, principal } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export function getJwtSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long');
}

export function setCookie(response, name, value, options = {}) {
  response.cookies.set(name, value, {
    path: options.path || '/',
    httpOnly: !!options.httpOnly,
    sameSite: options.sameSite ? options.sameSite.toLowerCase() : 'lax',
    maxAge: options.maxAge,
    secure: !!options.secure || process.env.NODE_ENV === 'production',
  });
}

export function deleteCookie(response, name) {
  response.cookies.delete(name);
}

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
  
  setCookie(response, cookieName, refreshToken, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: durationDays * 24 * 60 * 60,
  });

  // Register or Update session if tracking info provided (skip for students)
  if (ip && userAgent && userType !== 'student') {
    try {
      const SecurityService = (await import('@/services/SecurityService')).default;
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const sessionCookieName = `${userType.toLowerCase()}_session_id`;
      const existingSessionId = cookieStore.get(sessionCookieName)?.value;

      // We need the numeric DB ID for user_sessions
      let dbId;
      if (userType === 'student') {
        const student = await db.query.students.findFirst({ where: eq(students.roll_no, userId), columns: { id: true } });
        dbId = student?.id;
      } else if (userType === 'staff') {
        dbId = parseInt(userId);
      } else if (userType === 'admin') {
        dbId = parseInt(userId);
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
          setCookie(response, sessionCookieName, sessionId.toString(), {
            httpOnly: false,
            sameSite: 'Lax',
            maxAge: durationDays * 24 * 60 * 60,
          });
          // Clean up legacy non-role-specific cookie if present
          if (cookieStore.has('session_id')) {
            deleteCookie(response, 'session_id');
          }
        }
      }
    } catch (err) {
      console.error('Session management failed:', err);
      throw new Error('Failed to create user session or refresh token');
    }
  }

  return refreshToken;
}

/**
 * Generates a student auth JWT and attaches it to the provided NextResponse.
 */
export async function issueStudentAuthCookie(response, student, rememberMe = false, ip = null, userAgent = null) {
  const secret = getJwtSecretKey();
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

  // Clear cookies for other roles
  deleteCookie(response, 'admin_auth');
  deleteCookie(response, 'admin_logged_in');
  deleteCookie(response, 'admin_session_id');
  deleteCookie(response, 'admin_refresh_token');
  deleteCookie(response, 'staff_auth');
  deleteCookie(response, 'staff_logged_in');
  deleteCookie(response, 'staff_role');
  deleteCookie(response, 'staff_session_id');
  deleteCookie(response, 'staff_refresh_token');

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

  setCookie(response, 'student_auth', token, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: cookieMaxAge,
  });

  // Set companion cookies for UI (Must match refresh token duration)
  setCookie(response, 'student_logged_in', 'true', {
    httpOnly: false,
    sameSite: 'Lax',
    maxAge: cookieMaxAge,
  });

  // Issue Refresh Token
  await issueRefreshToken(response, student.roll_no, 'student', rememberMe, ip, userAgent);

  return response;
}

/**
 * Generates a staff auth JWT and attaches it to the provided NextResponse.
 */
export async function issueStaffAuthCookie(response, staff, rememberMe = false, ip = null, userAgent = null) {
  const secret = getJwtSecretKey();
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

  // Clear cookies for other roles
  deleteCookie(response, 'admin_auth');
  deleteCookie(response, 'admin_logged_in');
  deleteCookie(response, 'admin_session_id');
  deleteCookie(response, 'admin_refresh_token');
  deleteCookie(response, 'student_auth');
  deleteCookie(response, 'student_logged_in');
  deleteCookie(response, 'student_session_id');
  deleteCookie(response, 'student_refresh_token');

  const token = await new SignJWT({
    id: staff.id,
    staffId: staff.id,
    email: staff.email,
    role: staff.role,
    is_hod: !!staff.is_hod,
    branch: staff.branch,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  setCookie(response, 'staff_auth', token, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: cookieMaxAge,
  });

  // Set companion cookies for UI
  setCookie(response, 'staff_logged_in', 'true', {
    httpOnly: false,
    sameSite: 'Lax',
    maxAge: cookieMaxAge,
  });

  setCookie(response, 'staff_role', staff.role || '', {
    httpOnly: false,
    sameSite: 'Lax',
    maxAge: cookieMaxAge,
  });

  // Issue Refresh Token
  await issueRefreshToken(response, staff.id, 'staff', rememberMe, ip, userAgent);

  return response;
}

/**
 * Generates an admin auth JWT and attaches it to the provided NextResponse.
 */
export async function issueAdminAuthCookie(response, admin, rememberMe = false, ip = null, userAgent = null) {
  const secret = getJwtSecretKey();
  // Access token: 15 minutes. Refresh token: 14-30 days
  const sessionDuration = '15m';
  const durationDays = rememberMe ? 30 : 14;
  const cookieMaxAge = durationDays * 24 * 60 * 60;

  // Clear cookies for other roles
  deleteCookie(response, 'staff_auth');
  deleteCookie(response, 'staff_logged_in');
  deleteCookie(response, 'staff_role');
  deleteCookie(response, 'staff_session_id');
  deleteCookie(response, 'staff_refresh_token');
  deleteCookie(response, 'student_auth');
  deleteCookie(response, 'student_logged_in');
  deleteCookie(response, 'student_session_id');
  deleteCookie(response, 'student_refresh_token');

  const token = await new SignJWT({
    id: admin.id,
    email: admin.email,
    role: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(secret);

  setCookie(response, 'admin_auth', token, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: cookieMaxAge,
  });

  // Companion cookie
  setCookie(response, 'admin_logged_in', 'true', {
    httpOnly: false,
    sameSite: 'Lax',
    maxAge: cookieMaxAge,
  });

  // Issue Refresh Token
  await issueRefreshToken(response, admin.id, 'admin', rememberMe, ip, userAgent);

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
    } else if (userType === 'staff') {
      const user = await db.query.staffAccounts.findFirst({ where: eq(staffAccounts.id, parseInt(tokenRecord.user_id)) });
      if (!user || user.account_status !== 'ACTIVE') return null;
      
      // We need to resolve the staff role again since issueStaffAuthCookie needs it
      const { staffAccountRoles, staffRoles, staffAcademicAffiliations, academicDepartments } = await import('@/db/schema');
      const roleRecords = await db.select({ role_code: staffRoles.role_code })
        .from(staffAccountRoles)
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(eq(staffAccountRoles.staff_account_id, user.id))
        .limit(1);
        
      let resolvedRole = 'faculty';
      if (roleRecords.length > 0) {
          const rCode = roleRecords[0].role_code;
          if (rCode === 'ADMISSION_STAFF') resolvedRole = 'admission';
          else if (rCode === 'SCHOLARSHIP_STAFF') resolvedRole = 'scholarship';
          else resolvedRole = 'faculty';
      }

      let isHod = false;
      let branch = null;
      if (resolvedRole === 'faculty') {
          const affil = await db.select({ branch_code: academicDepartments.department_code })
              .from(staffAcademicAffiliations)
              .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
              .where(eq(staffAcademicAffiliations.staff_account_id, user.id))
              .limit(1);
          if (affil.length > 0) {
            branch = affil[0].branch_code;
          }

          const { facultyHodAssignments } = await import('@/db/schema');
          const hodRow = await db.select({ id: facultyHodAssignments.id })
              .from(facultyHodAssignments)
              .where(and(
                eq(facultyHodAssignments.staff_account_id, user.id),
                eq(facultyHodAssignments.is_active, true)
              ))
              .limit(1);
          if (hodRow.length > 0) {
            isHod = true;
          }
      }

      const adaptedStaff = {
         id: user.id,
         email: user.email,
         role: resolvedRole,
         is_hod: isHod,
         branch: branch
      };

      await issueStaffAuthCookie(response, adaptedStaff, true, ip, userAgent);
      return adaptedStaff;
    } else if (userType === 'admin') {
      const user = await db.query.principal.findFirst({ where: eq(principal.id, parseInt(tokenRecord.user_id)) });
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
