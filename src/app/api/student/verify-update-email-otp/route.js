import logger from '@/lib/logger';
import { db } from '@/db';
import { students, otpCodes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(getTieredKey(req, 'otp_verify'), 5, 900); // 5 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many verification attempts. Please try again in 15 minutes.', 429);
    }

    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);
    
    try {
      const { rollno, otp, email } = await req.json();
      if (!rollno || !otp || !email) {
        return apiError('Missing roll number, OTP, or email', 400);
      }

      const otpData = await db.query.otpCodes.findFirst({
        where: and(eq(otpCodes.identifier, rollno), eq(otpCodes.otp_code, otp))
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
