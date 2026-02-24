import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { sendInstitutionalEmail } from '@/lib/email';
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
      return apiError('Roll number is required', 400);
    }

    const studentEmail = await getStudentEmail(rollNo);
    if (!studentEmail) {
      return apiError('Student email not found.', 404);
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
      return apiError('Failed to store OTP.', 500);
    }
    // --- End Database Interaction ---

    const subject = 'KUCET One-Time Password (OTP)';
    const title = 'OTP for Email Verification';

    const bodyHtml = `
      <p>Dear Student,</p>
      <p>Please use the One-Time Password (OTP) provided below to complete your verification.</p>
      <p style="margin-top: 12px; font-weight: 600; font-size: 18px;">OTP: ${otp}</p>
      <p>This OTP is valid for the next 5 minutes. Do not share this code with anyone.</p>
    `;

    const bodyText = `Dear Student,

Please use the following One-Time Password (OTP) to complete your verification:

OTP: ${otp}

This OTP is valid for the next 5 minutes. Do not share this code with anyone.`;

    const emailResult = await sendInstitutionalEmail({
      to: studentEmail,
      subject,
      title,
      bodyHtml,
      bodyText
    });

    if (emailResult.success) {
      return apiResponse({ success: true, message: 'OTP sent successfully to your email.' });
    } else {
      console.error('Failed to send OTP email:', emailResult.message);
      // Optionally delete OTP from DB if email sending failed, to prevent stale OTPs
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return apiError(emailResult.message || 'Failed to send OTP email.', 500);
    }
  } catch (error) {
    console.error('Error in send-otp API:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
