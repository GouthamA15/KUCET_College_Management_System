import { db } from '@/db';
import { staffRegistrationRequests, staffAccounts, staffAccountActivationTokens, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { wrapHandler, apiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { sendInstitutionalEmail, getBaseUrl } from '@/lib/email';
import logger from '@/lib/logger';

export const POST = wrapHandler({
  auth: 'admin',
  handler: async (req, { user, context }) => {
    // Resolve ID from route params or fallback to URL splitting
    const params = await context?.params;
    let requestId = parseInt(params?.id, 10);
    if (isNaN(requestId)) {
      const pathname = req.nextUrl?.pathname || new URL(req.url, 'http://localhost').pathname;
      const segments = pathname.split('/').filter(Boolean);
      const resendIdx = segments.indexOf('resend-activation');
      if (resendIdx > 0) {
        requestId = parseInt(segments[resendIdx - 1], 10);
      }
    }

    if (isNaN(requestId) || requestId <= 0) {
      return apiError('Invalid request ID', 400);
    }

    const adminId = user?.id || user?.adminId;

    const result = await db.transaction(async (tx) => {
      // Find request
      const [request] = await tx
        .select()
        .from(staffRegistrationRequests)
        .where(eq(staffRegistrationRequests.id, requestId));

      if (!request) throw new Error('Request not found');
      if (request.status !== 'APPROVED') throw new Error('Request is not approved');

      // Find staff account
      const [account] = await tx
        .select()
        .from(staffAccounts)
        .where(eq(staffAccounts.email, request.email));

      if (!account) throw new Error('Staff account not found');
      if (account.account_status !== 'PENDING_ACTIVATION') throw new Error('Account is already active or suspended');

      // Generate new token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await tx.insert(staffAccountActivationTokens).values({
        staff_account_id: account.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      await tx.insert(auditLogs).values({
        user_id: adminId.toString(),
        user_type: 'admin',
        action: 'RESEND_ACTIVATION_EMAIL',
        entity_type: 'staff_accounts',
        entity_id: account.id.toString(),
        metadata: { requestId: request.id },
        ip_address: context?.ip || '127.0.0.1'
      });

      return {
        email: account.email,
        name: account.name,
        employeeId: account.employee_id,
        rawToken
      };
    });

    const baseUrl = getBaseUrl();
    const activationLink = `${baseUrl}/register/staff/activate?token=${result.rawToken}`;

    try {
      await sendInstitutionalEmail({
        to: result.email,
        subject: 'KUCET Staff Account Activation (Resend)',
        title: 'Account Activation (Resend)',
        bodyHtml: `<p>Welcome to KUCET, <strong>${result.name}</strong>.</p>
                   <p>Your staff registration has been approved. Please activate your account and set up your password.</p>`,
        infoRows: [
          { label: 'Employee ID', value: result.employeeId }
        ],
        action: {
          url: activationLink,
          label: 'Activate Account',
          expiresIn: '48 hours'
        }
      });
      logger.info({ email: result.email }, '[STAFF_APPROVAL] Resent activation email successfully');
    } catch (err) {
      logger.error({ email: result.email, err }, '[STAFF_APPROVAL] Failed to resend activation email');
      return { success: true, message: 'Token generated, but email failed to send.' };
    }

    return { success: true, message: 'Activation email resent successfully.' };
  }
});
