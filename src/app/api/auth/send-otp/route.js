import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { getStudentEmail } from '@/lib/student-utils';
import { query } from '@/lib/db'; // Assuming your db utility is here

// Helper to generate a secure 6-digit numeric OTP
function generateSecureOtp() {
  const length = 6;
  const min = Math.pow(10, length - 1); // 100000
  const max = Math.pow(10, length) - 1; // 999999
  const randomNumber = crypto.randomBytes(4).readUInt32LE(0); // 4 bytes = 32 bits of randomness
  const numericOtp = (min + (randomNumber % (max - min + 1))).toString();
  return numericOtp.padStart(length, '0');
}

export async function POST(request) {
  try {
    const { rollNo } = await request.json();

    if (!rollNo) {
      return NextResponse.json({ success: false, message: 'Roll number is required' }, { status: 400 });
    }

    const studentEmail = await getStudentEmail(rollNo);
    if (!studentEmail) {
      return NextResponse.json({ success: false, message: 'Student email not found.' }, { status: 404 });
    }

    const otp = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // --- Database Interaction to store OTP ---
    try {
      // Invalidate any previous OTPs for this roll_no (good practice for upsert)
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      // Store the new OTP
      await query(
        'INSERT INTO otp_codes (roll_no, otp_code, expires_at) VALUES (?, ?, ?)',
        [rollNo, otp, expiresAt.toISOString()]
      );
    } catch (dbError) {
      console.error('Error storing OTP in database:', dbError);
      return NextResponse.json({ success: false, message: 'Failed to store OTP.' }, { status: 500 });
    }
    // --- End Database Interaction ---

    const subject = 'Your KUCET OTP for Verification';
    const html = `<p>Dear Student,</p>
                  <p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
                  <p>This OTP is valid for the next 5 minutes. Do not share this with anyone.</p>
                  <p>If you did not request this, please ignore this email.</p>`;

    const emailResult = await sendEmail(studentEmail, subject, html);

    if (emailResult.success) {
      return NextResponse.json({ success: true, message: 'OTP sent successfully to your email.' });
    } else {
      console.error('Failed to send OTP email:', emailResult.message);
      // Optionally delete OTP from DB if email sending failed, to prevent stale OTPs
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return NextResponse.json({ success: false, message: emailResult.message || 'Failed to send OTP email.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in send-otp API:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
