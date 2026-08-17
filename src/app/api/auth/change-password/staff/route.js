import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

// ─── FIX #11: Password strength validation ───
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character.';
  }
  return null;
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    // ─── FIX #11: Validate new password strength ───
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return apiError(strengthError, 400);

    if (oldPassword === newPassword) {
      return apiError('New password must be different from the current password', 400);
    }

    const staff = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.email, user.email),
      columns: {
        password_hash: true
      }
    });

    if (!staff) {
      return apiError('Staff not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, staff.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    // ─── FIX #10: bcrypt cost raised from 10 → 12 ───
    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const now = (await import('@/lib/clock')).getNow();
    await db.update(staffAccounts)
      .set({ 
        password_hash: hashedPassword,
        password_changed_at: now,
        must_change_password: false
      })
      .where(eq(staffAccounts.email, user.email));

    // Log Security Event
    const fullStaff = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.email, user.email),
      columns: { id: true }
    });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const SecurityService = (await import('@/services/SecurityService')).default;
    await SecurityService.logSecurityEvent({
      userType: 'CLERK',
      userId: fullStaff.id,
      eventType: 'PASSWORD_CHANGED',
      ipAddress: ip
    });

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
