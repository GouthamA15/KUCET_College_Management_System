import { db } from '@/db';
import { 
  otpCodes, 
  passwordResetTokens, 
  refreshTokens, 
  attendanceSessions,
  rateLimits 
} from '@/db/schema';
import { lt, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * Database Garbage Collection (Pruning)
 * Removes expired tokens and temporary records to prevent database bloat.
 */
async function pruneExpiredRecords() {
  console.log('--- STARTING DATABASE GARBAGE COLLECTION ---');
  const now = new Date();
  
  try {
    // 1. Prune Expired OTPs
    const [otpRes] = await db.delete(otpCodes).where(lt(otpCodes.expires_at, now));
    console.log(`✅ Pruned ${otpRes.affectedRows || 0} expired OTP codes.`);

    // 2. Prune Expired Password Reset Tokens
    const [pwdRes] = await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expires_at, now));
    console.log(`✅ Pruned ${pwdRes.affectedRows || 0} expired password reset tokens.`);

    // 3. Prune Expired Refresh Tokens
    const [refreshRes] = await db.delete(refreshTokens).where(lt(refreshTokens.expires_at, now));
    console.log(`✅ Pruned ${refreshRes.affectedRows || 0} expired refresh tokens.`);

    // 4. Prune Expired Attendance Sessions (Inactive)
    const [sessionRes] = await db.delete(attendanceSessions)
      .where(lt(attendanceSessions.expires_at, now));
    console.log(`✅ Pruned ${sessionRes.affectedRows || 0} expired attendance sessions.`);

    // 5. Prune Expired Rate Limits
    const [rateRes] = await db.delete(rateLimits).where(lt(rateLimits.expire_at, now));
    console.log(`✅ Pruned ${rateRes.affectedRows || 0} expired rate limit entries.`);

    console.log('--- GARBAGE COLLECTION COMPLETE ---');
  } catch (error) {
    logger.error('[DB_PRUNE_ERROR] Garbage collection failed:', error.message);
    console.error('❌ Garbage collection failed. Check logs for details.');
    process.exit(1);
  }
}

// Run the pruning process
pruneExpiredRecords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
