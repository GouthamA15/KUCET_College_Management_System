import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { sendInstitutionalEmail } from '@/lib/email';
import { getStudentEmail } from '@/lib/student-utils';

function generateSecureOtp() {
  const length = 6;
  const min = Math.pow(10, length - 1); 
  const max = Math.pow(10, length) - 1; 
  const randomNumber = crypto.randomBytes(4).readUInt32LE(0);
  const numericOtp = (min + (randomNumber % (max - min + 1))).toString();
  return numericOtp.padStart(length, '0');
}

export async function POST(request) {
  try {
    const { rollNo } = await request.json();
    if (!rollNo) return apiError('Roll number is required', 400);

    const studentEmail = await getStudentEmail(rollNo);
    if (!studentEmail) return apiError('Student email not found.', 404);

    const otp = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    try {
      await db.delete(otpCodes).where(eq(otpCodes.roll_no, rollNo));
      await db.insert(otpCodes).values({
        roll_no: rollNo,
        otp_code: otp,
        expires_at: expiresAt
      });
    } catch (dbError) {
      console.error('Error storing OTP:', dbError);
      return apiError('Failed to store OTP.', 500);
    }

    const subject = 'KUCET One-Time Password (OTP)';
    const title = 'OTP for Email Verification';
    const bodyHtml = `
      <p>Dear Student,</p>
      <p>Please use the One-Time Password (OTP) provided below to complete your verification.</p>
      <p style="margin-top: 12px; font-weight: 600; font-size: 18px;">OTP: ${otp}</p>
      <p>This OTP is valid for the next 5 minutes. Do not share this code with anyone.</p>
    `;

    const emailResult = await sendInstitutionalEmail({
      to: studentEmail,
      subject,
      title,
      bodyHtml
    });

    if (emailResult.success) {
      return apiResponse({ success: true, message: 'OTP sent successfully to your email.' });
    } else {
      await db.delete(otpCodes).where(eq(otpCodes.roll_no, rollNo));
      return apiError('Please try again after 15 minutes.', 500);
    }
  } catch (error) {
    console.error('Error in send-otp API:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
