import logger from '@/lib/logger';
import { db } from '@/db';
import { refreshTokens, students, clerks, principal, userSessions } from '@/db/schema';
import { eq, and, _isNull } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { 
  issueStudentAuthCookie, 
  issueClerkAuthCookie, 
  issueAdminAuthCookie 
} from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const { type } = await req.json(); // 'student', 'clerk', or 'admin'
    if (!['student', 'clerk', 'admin'].includes(type)) {
      return apiError('Invalid user type', 400);
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(`${type}_refresh_token`)?.value;

    if (!refreshToken) {
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

    if (!tokenRecord) {
      return apiError('Invalid refresh token', 401);
    }

    // 2. Check if the specific session is revoked in user_sessions (Security Enhancement)
    const sessionRecord = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.session_token_hash, tokenHash),
        eq(userSessions.is_revoked, true)
      )
    });

    if (sessionRecord) {
      return apiError('Your session has been revoked. Please login again.', 401);
    }

    // 3. Check if revoked in refreshTokens
    if (tokenRecord.revoked_at) {
      // SECURITY: Potential theft if a revoked token is reused. 
      // Revoke all tokens for this user as a precaution.
      const now = (await import('@/lib/clock')).getNow();
      await db.update(refreshTokens)
        .set({ revoked_at: now })
        .where(and(
            eq(refreshTokens.user_id, tokenRecord.user_id),
            eq(refreshTokens.user_type, type)
        ));
      return apiError('Token revoked. Please login again.', 401);
    }

    // 4. Check if expired
    const now = (await import('@/lib/clock')).getNow();
    if (new Date(tokenRecord.expires_at) < now) {
      return apiError('Refresh token expired', 401);
    }

    // 5. Revoke old token
    await db.update(refreshTokens)
      .set({ revoked_at: now })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // 6. Fetch user and issue new tokens
    const response = apiResponse({ success: true, message: 'Token refreshed' });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    if (type === 'student') {
      const user = await db.query.students.findFirst({ where: eq(students.roll_no, tokenRecord.user_id) });
      if (!user) return apiError('User not found', 401);
      await issueStudentAuthCookie(response, user, true, ip, userAgent);
    } else if (type === 'clerk') {
      const user = await db.query.clerks.findFirst({ where: eq(clerks.email, tokenRecord.user_id) });
      if (!user || !user.is_active) return apiError('User not found or inactive', 401);
      await issueClerkAuthCookie(response, user, true, ip, userAgent);
    } else if (type === 'admin') {
      const user = await db.query.principal.findFirst({ where: eq(principal.email, tokenRecord.user_id) });
      if (!user) return apiError('User not found', 401);
      await issueAdminAuthCookie(response, user, true, ip, userAgent);
    }

    return response;

  } catch (error) {
    logger.error('[AUTH_REFRESH_ERROR]', error);
    return apiError('Internal Server Error', 500);
  }
}
