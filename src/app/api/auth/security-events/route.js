import { db } from '@/db';
import { securityEvents } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    // Check if student
    let user = await getAuthUser('student');
    let userType = 'STUDENT';
    
    if (!user) {
      // Check if staff
      user = await getAuthUser('staff');
      userType = 'STAFF';
    }

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // We need the database ID. getAuthUser might return different things based on role.
    // For student it usually returns { roll_no, ... }
    // For staff it usually returns { email, ... }
    
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

    if (!dbId) {
      return apiError('User not found', 404);
    }

    const events = await db.select()
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.user_id, dbId),
          eq(securityEvents.user_type, userType)
        )
      )
      .orderBy(desc(securityEvents.created_at))
      .limit(10);

    return apiResponse({ events });
  } catch (error) {
    logger.error('Error fetching security events:', error);
    return apiError('Internal server error', 500);
  }
}
