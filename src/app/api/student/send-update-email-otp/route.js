import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { rollno, email } = await req.json();

    if (!rollno || !email) {
      return NextResponse.json({ message: 'Missing roll number or email' }, { status: 400 });
    }

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    const db = getDb();
    
    // Invalidate any existing OTPs for this roll number
    await db.execute('DELETE FROM otp_codes WHERE roll_no = ?', [rollno]);

    // Store the new OTP
    await db.execute(
      'INSERT INTO otp_codes (roll_no, otp_code, expires_at) VALUES (?, ?, ?)',
      [rollno, otp, expiresAt]
    );

    // Send the OTP email
    const subject = 'Verify Your New Email Address';
    const html = `<p>Your OTP to verify your new email address is: <strong>${otp}</strong></p><p>This OTP will expire in 10 minutes.</p>`;
    
    const emailResponse = await sendEmail(email, subject, html);

    if (emailResponse.success) {
      return NextResponse.json({ message: 'OTP sent to your new email address.' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Failed to send OTP email.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
