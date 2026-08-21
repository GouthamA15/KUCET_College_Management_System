import { db } from '@/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import SecurityService from '@/services/SecurityService';
import crypto from 'crypto';
import logger from '@/lib/logger';
import { cookies } from 'next/headers';

export async function POST(_req) {
  try {
    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    if (!user) {
      user = await getAuthUser('staff');
      userType = 'STAFF';
    }
    if (!user) return apiError('Unauthorized', 401);

    if (userType === 'STUDENT') {
      return apiError('Forbidden', 403);
    }

    let dbId;
    if (userType === 'STUDENT') {
      const student = await db.query.students.findFirst({
        where: (students, { eq }) => eq(students.roll_no, user.roll_no),
        columns: { id: true }
      });
      dbId = student?.id;
    } else {
      const staff = await db.query.staffAccounts.findFirst({
        where: (staffAccounts, { eq }) => eq(staffAccounts.email, user.email),
        columns: { id: true }
      });
      dbId = staff?.id;
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(`${userType.toLowerCase()}_refresh_token`)?.value;
    const currentTokenHash = refreshToken ? crypto.createHash('sha256').update(refreshToken).digest('hex') : null;

    if (!currentTokenHash) return apiError('Current session not found', 400);

    const success = await SecurityService.revokeOtherSessions(userType, dbId, currentTokenHash);
    if (!success) return apiError('Failed to revoke sessions', 500);

    return apiResponse({ success: true, message: 'All other sessions revoked' });
  } catch (error) {
    logger.error('Error revoking other sessions:', error);
    return apiError('Internal server error', 500);
  }
}
