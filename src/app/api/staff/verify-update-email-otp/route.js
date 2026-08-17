import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

export async function POST(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`otp_verify_staff_${user.id}`, 8, 900); // 8 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many verification attempts. Please try again in 15 minutes.', 429);
    }
    
    try {
      const { otp, email } = await req.json();
      const staffId = user.id;
      if (!staffId || !otp || !email) {
        return apiError('Missing staff ID, OTP, or email', 400);
      }

      const identifierStr = String(staffId);
      const otpData = await db.query.otpCodes.findFirst({
        where: eq(otpCodes.identifier, identifierStr)
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

      const submittedHash = Buffer.from(hashOtp(otp), 'hex');
      const storedHash   = Buffer.from(otpData.otp_code, 'hex');
      const otpValid = submittedHash.length === storedHash.length &&
                       crypto.timingSafeEqual(submittedHash, storedHash);

      if (!otpValid) {
        return apiError('Invalid or expired OTP.', 400);
      }
      
      await db.update(staffAccounts)
        .set({ email: email })
        .where(eq(staffAccounts.id, staffId));

      await db.delete(otpCodes).where(eq(otpCodes.id, otpData.id));

      const updatedStaff = await db.query.staffAccounts.findFirst({
        where: eq(staffAccounts.id, staffId)
      });

      if (updatedStaff) {
        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.logSecurityEvent({
          userType: 'STAFF',
          userId: updatedStaff.id,
          eventType: 'EMAIL_VERIFIED',
          ipAddress: ip,
          details: { email }
        });
      }

      const response = apiResponse({ message: 'Email address verified and updated successfully!' });
      
      // Update the staff token because it includes the email
      const { issueStaffAuthCookie } = await import('@/lib/auth-utils');
      // Pass the updatedStaff and role info. Wait, issueStaffAuthCookie expects staff object with role, is_hod, branch.
      // We should preserve those from the existing token payload (user).
      const staffPayload = {
        id: updatedStaff.id,
        email: updatedStaff.email,
        role: user.role,
        is_hod: user.is_hod,
        branch: user.branch
      };
      await issueStaffAuthCookie(response, staffPayload);

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
