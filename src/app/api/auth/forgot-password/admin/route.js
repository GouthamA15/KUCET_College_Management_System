import { query } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [admin] = await query('SELECT email FROM principal WHERE email = ?', [email]);

    if (!admin) {
      // Generic message to prevent email enumeration
      return NextResponse.json({ message: 'If an account with this email exists, a password reset link has been sent.' }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    await query(
      'INSERT INTO password_reset_tokens (token, user_id, user_type, expires_at) VALUES (?, ?, ?, ?)',
      [token, email, 'admin', expires_at]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password/${token}`;
    
    const subject = 'KUCET Admin Password Reset Request';
    const html = `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                  <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                  <p><a href="${resetLink}">${resetLink}</a></p>
                  <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail(admin.email, subject, html);

    return NextResponse.json({ message: 'If an account with this email exists, a password reset link has been sent.' }, { status: 200 });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    // Still return a generic message to the user
    return NextResponse.json({ message: 'If an account with this email exists, a password reset link has been sent.' }, { status: 200 });
  }
}
