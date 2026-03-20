import { db } from '@/db';
import { clerks, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBaseUrl, sendInstitutionalEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return apiError('Email is required', 400);
    }

    const clerk = await db.query.clerks.findFirst({
      where: eq(clerks.email, email),
      columns: {
        email: true
      }
    });

    if (!clerk) {
      return apiError('Clerk not found', 404);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db.insert(passwordResetTokens).values({
      token_hash: tokenHash,
      user_id: email,
      user_type: 'clerk',
      expires_at: expires_at,
      used_at: null
    });

    const baseUrl = getBaseUrl();
    const resetLink = `${baseUrl}/reset-password/${token}`;

    const subject = 'KUCET Clerk Password Reset Request';
    const title = 'Clerk Password Reset Request';

    const bodyHtml = `
      <p>Dear Clerk,</p>
      <p>A request has been received to reset the password for your KUCET College Portal account.</p>
      <p>Please use the button below to securely reset your password.</p>
    `;

    const bodyText = `Dear Clerk,

A request has been received to reset the password for your KUCET College Portal account.
Please use the link below to securely reset your password:

${resetLink}

If you did not initiate this request, please ignore this email or contact the administration immediately.`;

    await sendInstitutionalEmail({
      to: clerk.email,
      subject,
      title,
      bodyHtml,
      bodyText,
      action: {
        url: resetLink,
        label: 'Reset Password',
        expiresIn: '10 minutes'
      }
    });

    return apiResponse({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
