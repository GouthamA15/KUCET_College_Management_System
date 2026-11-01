import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { passwordResetTokens, students, staffAccounts, principal, userSessions, refreshTokens, auditLogs } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import logger from '@/lib/logger';

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
const SALT_ROUNDS = 12;

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include at least one digit.';
  if (!/[^a-zA-Z\d]/.test(password)) return 'Password must include at least one special character.';
  return null;
}

export class PasswordResetService {
  /**
   * Hashes a raw token using SHA-256
   */
  static hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return '';
    return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  /**
   * Validates a password reset token and returns its status
   */
  static async validateToken(rawToken) {
    if (!rawToken) {
      return {
        valid: false,
        status: 'INVALID',
        statusCode: 400,
        message: 'This password reset link is invalid or malformed. Please request a new link.'
      };
    }

    const tokenHash = this.hashToken(rawToken);
    const tokenData = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token_hash, tokenHash)
    });

    if (!tokenData) {
      return {
        valid: false,
        status: 'INVALID',
        statusCode: 400,
        message: 'This password reset link is invalid or was not found. Please request a new reset link.'
      };
    }

    if (tokenData.used_at) {
      return {
        valid: false,
        status: 'USED',
        statusCode: 409,
        message: 'This password reset link has already been used. If you need to reset your password again, please request a new link.'
      };
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return {
        valid: false,
        status: 'EXPIRED',
        statusCode: 410,
        message: 'This password reset link has expired (valid for 60 minutes). For security, please request a new reset link.'
      };
    }

    return {
      valid: true,
      status: 'VALID',
      statusCode: 200,
      tokenData
    };
  }

  /**
   * Atomically consumes the token, resets the password, revokes all active sessions & refresh tokens.
   */
  static async executeReset({ rawToken, newPassword, clientIp = null, userAgent = null }) {
    if (!rawToken || !newPassword) {
      return { success: false, statusCode: 400, error: 'Missing token or password' };
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return { success: false, statusCode: 400, error: strengthError };
    }

    const validation = await this.validateToken(rawToken);
    if (!validation.valid) {
      return { success: false, statusCode: validation.statusCode, error: validation.message, status: validation.status };
    }

    const { tokenData } = validation;
    const tokenHash = this.hashToken(rawToken);
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        let numericUserId = null;

        // 1. Update user password in appropriate table
        if (tokenData.user_type === 'student') {
          const studentRecord = await tx.query.students.findFirst({
            where: eq(students.roll_no, tokenData.user_id),
            columns: { id: true }
          });
          numericUserId = studentRecord?.id || null;

          await tx.update(students)
            .set({ 
              password_hash: hashedPassword,
              password_changed_at: now
            })
            .where(eq(students.roll_no, tokenData.user_id));
        } else if (tokenData.user_type === 'staff') {
          const staffRecord = await tx.query.staffAccounts.findFirst({
            where: eq(staffAccounts.email, tokenData.user_id),
            columns: { id: true }
          });
          numericUserId = staffRecord?.id || null;

          await tx.update(staffAccounts)
            .set({ 
              password_hash: hashedPassword,
              password_changed_at: now
            })
            .where(eq(staffAccounts.email, tokenData.user_id));
        } else if (tokenData.user_type === 'admin') {
          const adminRecord = await tx.query.principal.findFirst({
            where: eq(principal.email, tokenData.user_id),
            columns: { id: true }
          });
          numericUserId = adminRecord?.id || null;

          await tx.update(principal)
            .set({ 
              password_hash: hashedPassword,
              password_changed_at: now
            })
            .where(eq(principal.email, tokenData.user_id));
        }

        // 2. Atomically mark token as used
        const [res] = await tx.update(passwordResetTokens)
          .set({ used_at: now })
          .where(and(eq(passwordResetTokens.token_hash, tokenHash), isNull(passwordResetTokens.used_at)));

        if (res.affectedRows === 0) {
          throw new Error('TOKEN_ALREADY_USED');
        }

        // 3. Invalidate active sessions in userSessions
        if (numericUserId) {
          const roleUpper = tokenData.user_type === 'student' ? 'STUDENT' : tokenData.user_type === 'staff' ? 'STAFF' : 'ADMIN';
          await tx.update(userSessions)
            .set({ is_revoked: true })
            .where(and(
              eq(userSessions.user_id, numericUserId),
              eq(userSessions.user_type, roleUpper)
            ));
        }

        // 4. Invalidate refresh tokens in refreshTokens
        const userIdVariants = [tokenData.user_id];
        if (numericUserId) userIdVariants.push(numericUserId.toString());

        for (const uid of userIdVariants) {
          await tx.update(refreshTokens)
            .set({ revoked_at: now })
            .where(and(
              eq(refreshTokens.user_id, uid),
              eq(refreshTokens.user_type, tokenData.user_type),
              isNull(refreshTokens.revoked_at)
            ));
        }

        // 5. Insert security audit log
        try {
          await tx.insert(auditLogs).values({
            user_id: numericUserId,
            user_type: tokenData.user_type,
            action: 'PASSWORD_RESET',
            target_id: tokenData.user_id,
            target_type: tokenData.user_type,
            payload_after: { reset_at: now.toISOString(), revoked_sessions: true },
            ip_address: clientIp ? clientIp.substring(0, 45) : null,
            user_agent: userAgent ? userAgent.substring(0, 500) : null,
          });
        } catch (auditErr) {
          logger.warn({ err: auditErr.message }, '[PASSWORD_RESET] Audit log insertion skipped');
        }
      });

      logger.info({ userType: tokenData.user_type, userId: tokenData.user_id }, '[PASSWORD_RESET_SUCCESS]');
      return { success: true, statusCode: 200, message: 'Password reset successful' };
    } catch (err) {
      if (err.message === 'TOKEN_ALREADY_USED') {
        return { success: false, statusCode: 409, error: 'This password reset link has already been used. Please request a new link.' };
      }
      logger.error({ err }, 'PASSWORD RESET EXECUTION ERROR');
      return { success: false, statusCode: 500, error: 'Internal server error while resetting password' };
    }
  }
}

export default PasswordResetService;
