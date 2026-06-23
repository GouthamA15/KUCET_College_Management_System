import { db } from '@/db';
import { _userSessions } from '@/db/schema';
import { _eq, _and, _gt, _desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import SecurityService from '@/services/SecurityService';
import crypto from 'crypto';
import logger from '@/lib/logger';
import { cookies } from 'next/headers';

export async function GET(_req) {
  try {
    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    
    if (!user) {
      user = await getAuthUser('clerk');
      userType = 'CLERK';
    }

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    let dbId;
    if (userType === 'STUDENT') {
      const student = await db.query.students.findFirst({
        where: (students, { eq }) => eq(students.roll_no, user.roll_no),
        columns: { id: true }
      });
      dbId = student?.id;
    } else {
      const clerk = await db.query.clerks.findFirst({
        where: (clerks, { eq }) => eq(clerks.email, user.email),
        columns: { id: true }
      });
      dbId = clerk?.id;
    }

    if (!dbId) return apiError('User not found', 404);

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(`${userType.toLowerCase()}_refresh_token`)?.value;
    const currentTokenHash = refreshToken ? crypto.createHash('sha256').update(refreshToken).digest('hex') : null;

    const sessions = await SecurityService.getActiveSessions(userType, dbId, currentTokenHash);

    return apiResponse({ sessions });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(req) {
  // Revoke a specific session (passed in body or query?)
  // Let's use body for simplicity or move to [id]/route.js
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return apiError('Session ID required', 400);

    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    if (!user) {
      user = await getAuthUser('clerk');
      userType = 'CLERK';
    }
    if (!user) return apiError('Unauthorized', 401);

    let dbId;
    if (userType === 'STUDENT') {
      const student = await db.query.students.findFirst({
        where: (students, { eq }) => eq(students.roll_no, user.roll_no),
        columns: { id: true }
      });
      dbId = student?.id;
    } else {
      const clerk = await db.query.clerks.findFirst({
        where: (clerks, { eq }) => eq(clerks.email, user.email),
        columns: { id: true }
      });
      dbId = clerk?.id;
    }

    const success = await SecurityService.revokeSession(userType, dbId, sessionId);
    if (!success) return apiError('Failed to revoke session', 500);

    return apiResponse({ success: true, message: 'Session revoked' });
  } catch (error) {
    logger.error('Error revoking session:', error);
    return apiError('Internal server error', 500);
  }
}
