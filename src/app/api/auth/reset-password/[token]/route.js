import logger from '@/lib/logger';
import { db } from '@/db';
import { passwordResetTokens, students, clerks, principal } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export async function GET(req, { params }) {
  try {
    const resolved = params ? await params : {};
    const { token } = resolved || {};
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
    const resolved = params ? await params : {};
    const { token } = resolved || {};
    const { password } = await req.json();

    if (!token || !password) return apiError('Missing token or password', 400);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token_hash, tokenHash)
    });

    if (!tokenData) return apiError('INVALID', 400);
    if (tokenData.used_at) return apiError('USED', 409);
    const { getNow } = await import('@/lib/clock');
    if (getNow() > new Date(tokenData.expires_at)) return apiError('EXPIRED', 410);

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

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
