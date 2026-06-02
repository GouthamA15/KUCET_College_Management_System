import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const clerk = await db.query.clerks.findFirst({
      where: eq(clerks.email, user.email),
      columns: {
        password_hash: true
      }
    });

    if (!clerk) {
      return apiError('Clerk not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, clerk.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    if (oldPassword === newPassword) {
      return apiError('New password must be different from the current password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const now = (await import('@/lib/clock')).getNow();
    await db.update(clerks)
      .set({ 
        password_hash: hashedPassword,
        password_changed_at: now
      })
      .where(eq(clerks.email, user.email));

    // Log Security Event
    const fullClerk = await db.query.clerks.findFirst({
      where: eq(clerks.email, user.email),
      columns: { id: true }
    });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const SecurityService = (await import('@/services/SecurityService')).default;
    await SecurityService.logSecurityEvent({
      userType: 'CLERK',
      userId: fullClerk.id,
      eventType: 'PASSWORD_CHANGED',
      ipAddress: ip
    });

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
