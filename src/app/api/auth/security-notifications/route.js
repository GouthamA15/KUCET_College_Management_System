import { db } from '@/db';
import { securityNotifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    if (!user) {
      user = await getAuthUser('clerk');
      userType = 'CLERK';
    }
    if (!user) return apiError('Unauthorized', 401);

    if (userType === 'STUDENT') {
      return apiResponse({ notifications: [] });
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

    const notifications = await db
      .select()
      .from(securityNotifications)
      .where(and(
        eq(securityNotifications.user_id, dbId),
        eq(securityNotifications.user_type, userType)
      ))
      .orderBy(desc(securityNotifications.created_at));

    return apiResponse({ notifications });
  } catch (error) {
    logger.error('Error fetching security notifications:', error);
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(req) {
  try {
    const { notificationId, markAll } = await req.json();

    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    if (!user) {
      user = await getAuthUser('clerk');
      userType = 'CLERK';
    }
    if (!user) return apiError('Unauthorized', 401);

    if (userType === 'STUDENT') {
      return apiResponse({ success: true });
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

    if (markAll) {
      await db
        .update(securityNotifications)
        .set({ is_read: true })
        .where(and(
          eq(securityNotifications.user_id, dbId),
          eq(securityNotifications.user_type, userType)
        ));
    } else if (notificationId) {
      await db
        .update(securityNotifications)
        .set({ is_read: true })
        .where(and(
          eq(securityNotifications.id, notificationId),
          eq(securityNotifications.user_id, dbId),
          eq(securityNotifications.user_type, userType)
        ));
    }

    return apiResponse({ success: true });
  } catch (error) {
    logger.error('Error updating security notifications:', error);
    return apiError('Internal server error', 500);
  }
}
