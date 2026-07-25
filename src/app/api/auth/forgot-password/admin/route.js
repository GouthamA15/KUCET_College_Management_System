import logger from '@/lib/logger';
import { db } from '@/db';
import { principal, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBaseUrl, sendInstitutionalEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  // ─── FIX #12: Rate limiting on admin forgot-password (3 per 15 min per IP) ───
  try {
    let clientIp = req.ip;
    if (!clientIp) {
      const xff = req.headers.get('x-forwarded-for');
      clientIp = xff ? xff.split(',')[0].trim() : `anon-${crypto.randomBytes(4).toString('hex')}`;
    }

    const rateCheck = await checkRateLimit(`forgot_pwd_admin:${clientIp}`, 3, 900); // 3 per 15 min
    if (!rateCheck.success) {
      const retryAfter = rateCheck.resetIn || rateCheck.ttl || rateCheck.reset || 900;
      return NextResponse.json(
        { message: 'If an account with this email exists, a password reset link has been sent.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

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

    // Generic message to prevent email enumeration (already correct — maintained)
    const GENERIC_OK = apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });

    if (!admin) return GENERIC_OK;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // ─── FIX #14: Use getNow() (IST clock) instead of Date.now() ───
    const { getNow } = await import('@/lib/clock');
    const now = getNow();

    // ─── FIX #15: Reset token expiry raised from 10 min → 60 min ───
    const expires_at = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes

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
        expiresIn: '60 minutes'
      }
    });

    return GENERIC_OK;
  } catch (error) {
    logger.error('FORGOT PASSWORD ERROR:', error);
    // Still return a generic message to the user
    return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
  }
}
