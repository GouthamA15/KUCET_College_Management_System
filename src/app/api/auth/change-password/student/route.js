import logger from '@/lib/logger';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

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
    // ─── FIX #13: Rate limiting on change-password/student (5 per 15 min) ───
    const rateCheck = await checkRateLimit(getTieredKey(req, 'change_pwd_student'), 5, 900);
    if (!rateCheck.success) {
      const retryAfter = rateCheck.resetIn || rateCheck.ttl || rateCheck.reset || 900;
      return NextResponse.json(
        { error: 'Too many password change attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    // ─── FIX #11: Validate new password strength ───
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return apiError(strengthError, 400);

    // Prevent reuse of current password
    if (oldPassword === newPassword) {
      return apiError('New password must be different from the current password.', 400);
    }

    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, user.roll_no),
      columns: {
        password_hash: true
      }
    });

    if (!student) {
      return apiError('Student not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, student.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    // ─── FIX #10: bcrypt cost raised from 10 → 12 ───
    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.update(students)
      .set({ password_hash: hashedPassword })
      .where(eq(students.roll_no, user.roll_no));

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
