import logger from '@/lib/logger';
import { db } from '@/db';
import { passwordResetTokens, students, clerks, principal } from '@/db/schema';
import { eq, and, isNull, _sql } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// ─── FIX #11: Password strength validation ───
// Enforces 8+ chars, at least one uppercase, lowercase, digit, and special character.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character.';
  }
  return null; // valid
}

export async function GET(req, { params }) {
  try {
    const resolved = params ? await params : { /* empty */ };
    const { token } = resolved || { /* empty */ };
    if (!token) return apiError('INVALID', 400);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token_hash, tokenHash)
    });

    if (!tokenData) return apiError('INVALID', 400);
    if (tokenData.used_at) return apiError('USED', 409);
    const { getNow } = await import('@/lib/clock');
    if (getNow() > new Date(tokenData.expires_at)) return apiError('EXPIRED', 410);

    return apiResponse({ status: 'VALID' });
  } catch (err) {
    logger.error('RESET TOKEN VALIDATION ERROR:', err);
    return apiError('INVALID', 400);
  }
}

export async function POST(req, { params }) {
  try {
    const resolved = params ? await params : { /* empty */ };
    const { token } = resolved || { /* empty */ };
    const { password } = await req.json();

    if (!token || !password) return apiError('Missing token or password', 400);

    // ─── FIX #11: Validate password strength before hashing ───
    const strengthError = validatePasswordStrength(password);
    if (strengthError) return apiError(strengthError, 400);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token_hash, tokenHash)
    });

    if (!tokenData) return apiError('INVALID', 400);
    if (tokenData.used_at) return apiError('USED', 409);
    const { getNow } = await import('@/lib/clock');
    if (getNow() > new Date(tokenData.expires_at)) return apiError('EXPIRED', 410);

    // ─── FIX #10: bcrypt cost raised from 10 → 12 ───
    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await db.transaction(async (tx) => {
      // 1. Update the appropriate user table
      if (tokenData.user_type === 'student') {
        await tx.update(students).set({ password_hash: hashedPassword }).where(eq(students.roll_no, tokenData.user_id));
      } else if (tokenData.user_type === 'clerk') {
        await tx.update(clerks).set({ password_hash: hashedPassword }).where(eq(clerks.email, tokenData.user_id));
      } else if (tokenData.user_type === 'admin') {
        await tx.update(principal).set({ password_hash: hashedPassword }).where(eq(principal.email, tokenData.user_id));
      } else {
        throw new Error('INVALID_USER_TYPE');
      }

      // 2. Mark token as used
      const [res] = await tx.update(passwordResetTokens)
        .set({ used_at: getNow() })
        .where(and(eq(passwordResetTokens.token_hash, tokenHash), isNull(passwordResetTokens.used_at)));
      
      // Check for concurrent usage
      if (res.affectedRows === 0) {
        throw new Error('TOKEN_ALREADY_USED');
      }
    });

    return apiResponse({ message: 'Password reset successful' });
  } catch (err) {
    if (err.message === 'TOKEN_ALREADY_USED') return apiError('USED', 409);
    logger.error('RESET PASSWORD ERROR:', err);
    return apiError('Internal server error', 500);
  }
}
