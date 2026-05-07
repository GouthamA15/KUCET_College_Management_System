import logger from '@/lib/logger';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const rollNo = body.rollNo || body.rollno;
    const email = body.email;
    const submittedOtp = body.submittedOtp || body.otp;
    
    const identifier = rollNo || email;

    if (!identifier || !submittedOtp) return apiError('Identifier and OTP are required', 400);

    const storedOtpRecord = await db.query.otpCodes.findFirst({
      where: eq(otpCodes.identifier, identifier)
    });

    if (!storedOtpRecord) return apiError('Invalid or expired OTP.', 400);

    const { id, otp_code, expires_at } = storedOtpRecord;

    if (new Date() > new Date(expires_at)) {
      await db.delete(otpCodes).where(eq(otpCodes.id, id));
      return apiError('OTP has expired.', 400);
    }

    if (submittedOtp === otp_code) {
      await db.delete(otpCodes).where(eq(otpCodes.id, id));
      return apiResponse({ success: true, message: 'OTP verified successfully.' });
    } else {
      return apiError('Invalid OTP.', 400);
    }
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
