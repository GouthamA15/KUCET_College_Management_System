import { db } from '@/db';
import { principal, passwordResetTokens } from '@/db/schema';
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

    const admin = await db.query.principal.findFirst({
      where: eq(principal.email, email),
      columns: {
        email: true
      }
    });

    if (!admin) {
      // Generic message to prevent email enumeration
      return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db.insert(passwordResetTokens).values({
      token_hash: tokenHash,
      user_id: email,
      user_type: 'admin',
      expires_at: expires_at,
      used_at: null
    });

    const baseUrl = getBaseUrl();
    const resetLink = `${baseUrl}/reset-password/${token}`;

    const subject = 'KUCET Admin Password Reset Request';
    const title = 'Admin Password Reset Request';

    const bodyHtml = `
      <p>Dear Administrator,</p>
      <p>A request has been received to reset the password for your KUCET College Portal account.</p>
      <p>Please use the button below to securely reset your password.</p>
    `;

    const bodyText = `Dear Administrator,

A request has been received to reset the password for your KUCET College Portal account.
Please use the link below to securely reset your password:

${resetLink}

If you did not initiate this request, please ignore this email or contact the administration immediately.`;

    await sendInstitutionalEmail({
      to: admin.email,
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

    return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    // Still return a generic message to the user
    return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
  }
}
