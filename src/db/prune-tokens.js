import { db } from './index.js';
import { 
  otpCodes, 
  passwordResetTokens, 
  refreshTokens, 
  attendanceSessions,
  rateLimits 
} from './schema.js';
import { lt, and, eq } from 'drizzle-orm';
import logger from '../lib/logger.js';

/**
 * Database Garbage Collection (Pruning)
 * Removes expired tokens and temporary records to prevent database bloat.
 * NEVER deletes attendance_sessions (which have CASCADE FKs to student_attendance);
 * only deactivates expired active PIN sessions.
 */
export async function pruneExpiredRecords() {
  logger.info('--- STARTING DATABASE GARBAGE COLLECTION ---');
  const now = new Date();
  
  try {
    // 1. Prune Expired OTPs
    const otpRes = await db.delete(otpCodes).where(lt(otpCodes.expires_at, now));
    const otpCount = otpRes.length || otpRes.affectedRows || 0;
    logger.info({ affectedRows: otpCount, table: 'otp_codes' }, 'Pruned expired OTP codes');

    // 2. Prune Expired Password Reset Tokens
    const pwdRes = await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expires_at, now));
    const pwdCount = pwdRes.length || pwdRes.affectedRows || 0;
    logger.info({ affectedRows: pwdCount, table: 'password_reset_tokens' }, 'Pruned expired password reset tokens');

    // 3. Prune Expired Refresh Tokens
    const refreshRes = await db.delete(refreshTokens).where(lt(refreshTokens.expires_at, now));
    const refreshCount = refreshRes.length || refreshRes.affectedRows || 0;
    logger.info({ affectedRows: refreshCount, table: 'refresh_tokens' }, 'Pruned expired refresh tokens');

    // 4. Deactivate Expired Attendance Sessions (NEVER delete finalized or historical sessions)
    const sessionRes = await db
      .update(attendanceSessions)
      .set({ is_active: false })
      .where(and(eq(attendanceSessions.is_active, true), lt(attendanceSessions.expires_at, now)));
    const sessionCount = sessionRes.length || sessionRes.affectedRows || 0;
    logger.info({ affectedRows: sessionCount, table: 'attendance_sessions' }, 'Deactivated expired attendance sessions');

    // 5. Prune Expired Rate Limits
    const rateRes = await db.delete(rateLimits).where(lt(rateLimits.expires_at, now));
    const rateCount = rateRes.length || rateRes.affectedRows || 0;
    logger.info({ affectedRows: rateCount, table: 'rate_limits' }, 'Pruned expired rate limit entries');

    logger.info('--- GARBAGE COLLECTION COMPLETE ---');
  } catch (error) {
    logger.error({ err: error }, '[DB_PRUNE_ERROR] Garbage collection failed');
    throw error;
  }
}

// Run the pruning process when executed directly via CLI (`npm run db:prune`)
if (!process.env.VITEST) {
  pruneExpiredRecords()
    .then(() => process.exit(0))
    .catch((_err) => {
      process.exit(1);
    });
}
