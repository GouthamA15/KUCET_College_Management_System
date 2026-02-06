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

    const [clerk] = await query('SELECT email FROM clerks WHERE email = ?', [email]);

    if (!clerk) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const created_at = new Date();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await query(
      'INSERT INTO password_reset_tokens (token_hash, user_id, user_type, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)',
      [tokenHash, email, 'clerk', created_at, expires_at]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password/${token}`;
    
    const subject = 'KUCET Clerk Password Reset Request';
    const html = `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                  <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                  <p><a href="${resetLink}">${resetLink}</a></p>
                  <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail(clerk.email, subject, html);

    return NextResponse.json({ message: 'Password reset link sent to your email' }, { status: 200 });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
