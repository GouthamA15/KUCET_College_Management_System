import { db } from '@/db';
import { staffAccounts, staffAccountActivationTokens, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { wrapHandler, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const POST = wrapHandler({
  schema: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }),
  handler: async (req, { context, data, ip }) => {
    const rateCheck = await checkRateLimit(`staff_activate:${ip || 'anon'}`, 5, 900);
    if (!rateCheck.success) {
      return apiError('Too many activation attempts. Please try again later.', 429);
    }

    const { token, password } = data;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await db.transaction(async (tx) => {
      // Find token
      const [tokenRecord] = await tx
        .select()
        .from(staffAccountActivationTokens)
        .where(eq(staffAccountActivationTokens.token_hash, tokenHash))
        .for('update'); // lock token row

      if (!tokenRecord) {
        throw new Error('This activation link is invalid.');
      }

      if (tokenRecord.used_at) {
        throw new Error('This activation link has already been used.');
      }

      if (new Date() > new Date(tokenRecord.expires_at)) {
        throw new Error('This activation link has expired.');
      }

      // Find account
      const [account] = await tx
        .select()
        .from(staffAccounts)
        .where(eq(staffAccounts.id, tokenRecord.staff_account_id))
        .for('update'); // lock account row

      if (!account) {
        throw new Error('Associated staff account not found.');
      }

      if (account.account_status === 'ACTIVE') {
        throw new Error('This account has already been activated.');
      }

      if (account.account_status !== 'PENDING_ACTIVATION') {
        throw new Error(`Cannot activate account in status: ${account.account_status}`);
      }

      // Hash password using project standard SALT_ROUNDS = 12
      const passwordHash = await bcrypt.hash(password, 12);

      // Update account
      await tx.update(staffAccounts)
        .set({
          password_hash: passwordHash,
          account_status: 'ACTIVE',
        })
        .where(eq(staffAccounts.id, account.id));

      // Mark token used
      await tx.update(staffAccountActivationTokens)
        .set({ used_at: new Date() })
        .where(eq(staffAccountActivationTokens.id, tokenRecord.id));

      // Audit log
      await tx.insert(auditLogs).values({
        user_id: account.id.toString(),
        user_type: 'system',
        action: 'STAFF_ACCOUNT_ACTIVATED',
        entity_type: 'staff_accounts',
        entity_id: account.id.toString(),
        metadata: { method: 'token_activation' },
        ip_address: context?.ip || '127.0.0.1'
      });

      return { success: true, employeeId: account.employee_id };
    });

    return { success: true, message: 'Account activated successfully.' };
  }
});
