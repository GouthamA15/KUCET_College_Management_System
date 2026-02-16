import { query } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return apiError('Email is required', 400);
    }

    const [admin] = await query('SELECT email FROM principal WHERE email = ?', [email]);

    if (!admin) {
      // Generic message to prevent email enumeration
      return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const created_at = new Date();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await query(
      'INSERT INTO password_reset_tokens (token_hash, user_id, user_type, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)',
      [tokenHash, email, 'admin', created_at, expires_at]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password/${token}`;
    
    const subject = 'KUCET Admin Password Reset Request';
    const html = `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                  <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                  <p><a href="${resetLink}">${resetLink}</a></p>
                  <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail(admin.email, subject, html);

    return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    // Still return a generic message to the user
    return apiResponse({ message: 'If an account with this email exists, a password reset link has been sent.' });
  }
}
