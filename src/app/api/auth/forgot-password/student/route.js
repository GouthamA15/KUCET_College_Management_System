import { query } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { rollno } = await req.json();
    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const [student] = await query('SELECT email FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    await query(
      'INSERT INTO password_reset_tokens (token, user_id, user_type, expires_at) VALUES (?, ?, ?, ?)',
      [token, rollno, 'student', expires_at]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password/${token}`;
    
    const subject = 'KUCET Password Reset Request';
    const html = `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                  <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                  <p><a href="${resetLink}">${resetLink}</a></p>
                  <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail(student.email, subject, html);

    return NextResponse.json({ message: 'Password reset link sent to your email' }, { status: 200 });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
