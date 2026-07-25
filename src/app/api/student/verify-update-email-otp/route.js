import logger from '@/lib/logger';
import { db } from '@/db';
import { students, otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import crypto from 'crypto';

// Must match the hashing used in send-update-email-otp/route.js
function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

export async function POST(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`otp_verify_${user.roll_no}`, 8, 900); // 8 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many verification attempts. Please try again in 15 minutes.', 429);
    }
    
    try {
      const { otp, email } = await req.json();
      const rollno = user.roll_no;
      if (!rollno || !otp || !email) {
        return apiError('Missing roll number, OTP, or email', 400);
      }

      const otpData = await db.query.otpCodes.findFirst({
        // Fetch by identifier only; compare hash in application layer to avoid DB-level timing oracle
        where: eq(otpCodes.identifier, rollno)
      });

      if (!otpData) {
        return apiError('Invalid or expired OTP.', 400);
      }

      const { getNow } = await import('@/lib/clock');
      const now = getNow();

      if (now > new Date(otpData.expires_at)) {
        await db.delete(otpCodes).where(eq(otpCodes.id, otpData.id));
        return apiError('OTP has expired. Please request a new one.', 400);
      }

      // ─── FIX #4/#6: Compare SHA-256(submitted) vs stored hash using timingSafeEqual ───
      const submittedHash = Buffer.from(hashOtp(otp), 'hex');
      const storedHash   = Buffer.from(otpData.otp_code, 'hex');
      const otpValid = submittedHash.length === storedHash.length &&
                       crypto.timingSafeEqual(submittedHash, storedHash);

      if (!otpValid) {
        return apiError('Invalid or expired OTP.', 400);
      }
      
      await db.update(students)
        .set({ 
          email: email, 
          is_email_verified: true, 
          email_verified_at: now 
        })
        .where(eq(students.roll_no, rollno));

      await db.delete(otpCodes).where(eq(otpCodes.id, otpData.id));

      const updatedStudent = await db.query.students.findFirst({
        where: eq(students.roll_no, rollno)
      });

      if (updatedStudent) {
        // Log Security Event
        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.logSecurityEvent({
          userType: 'STUDENT',
          userId: updatedStudent.id,
          eventType: 'EMAIL_VERIFIED',
          ipAddress: ip,
          details: { email }
        });
      }

      const response = apiResponse({ message: 'Email address verified and updated successfully!' });
      const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
      await issueStudentAuthCookie(response, updatedStudent);

      return response;

    } catch (error) {
      logger.error('Verify OTP Error:', error);
      return apiError('An internal server error occurred.', 500);
    }
  } catch (outerError) {
    logger.error('[CRITICAL] Verify OTP Rate Limit/Auth Error:', outerError);
    return apiError('Internal Server Error', 500);
  }
}
