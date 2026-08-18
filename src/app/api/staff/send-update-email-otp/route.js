import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, otpCodes } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { sendInstitutionalEmail } from '@/lib/email';
import crypto from 'crypto';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);

    const _ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`otp_send_staff_${user.id}`, 8, 900); // 8 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Please try again after 15 minutes.', 429);
    }

    try {
      const body = await req.json();
      const staffId = user.id;
      const rawEmail = body.email ? String(body.email) : '';
      const email = rawEmail.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9@.\-_]/g, '');

      if (!staffId || !email) {
        return apiError('Missing staff ID or email', 400);
      }

      // Server-side email uniqueness check
      const existingEmailRows = await db.select({ id: staffAccounts.id })
        .from(staffAccounts)
        .where(and(
          eq(staffAccounts.email, email),
          ne(staffAccounts.id, staffId)
        ))
        .limit(1);

      if (existingEmailRows.length > 0) {
        return apiError('Please check your details and try again.', 409);
      }
      
      const otp = crypto.randomInt(100000, 999999).toString();

      // Store OTP as SHA-256 hash — never plaintext
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

      const { getNow } = await import('@/lib/clock');
      const now = getNow();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      // We use String(staffId) because identifier in otp_codes might be a string
      const identifierStr = String(staffId);

      try {
        await db.delete(otpCodes).where(eq(otpCodes.identifier, identifierStr));
        await db.insert(otpCodes).values({
          identifier: identifierStr,
          otp_code: otpHash,  // stored as hash, NOT plaintext
          expires_at: expiresAt
        });
      } catch (dbError) {
        logger.error(dbError, '[DATABASE ERROR] OTP management failed');
        return apiError(`Please try again after 15 minutes. (DB Error: ${dbError.message || dbError})`, 500);
      }

      const subject = 'Verify Your Email Address';
      const staffName = user.name || 'Staff Member';
      const actionText = 'verify your new email address for your staff portal account';
      
      const bodyHtml = `
        <p style="margin:0 0 12px 0;font-size:15px;color:#111827;">Hello <strong>${staffName}</strong>,</p>
        <p style="margin:0 0 18px 0;font-size:14px;color:#374151;">Use the secure One-Time Password (OTP) below to ${actionText}.</p>
        <div style="text-align:center;margin:18px 0;">
          <div style="display:inline-block;padding:16px 26px;border-radius:8px;background:linear-gradient(180deg,#ffffff,#f7f9fb);border:1px solid #e6e9ee;">
            <div style="font-size:26px;letter-spacing:4px;font-weight:700;color:#0b5ed7;">${otp}</div>
          </div>
        </div>
        <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">This OTP will expire in <strong>10 minutes</strong>. For your security, do not share this code with anyone.</p>
        <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">If you did not request this, please ignore this email.</p>
      `;

      let emailResponse;
      try {
        emailResponse = await sendInstitutionalEmail({
          to: email,
          subject,
          title: 'Email Verification',
          bodyHtml: bodyHtml,
        });
      } catch (mailError) {
        logger.error(mailError, '[MAIL EXCEPTION] Failed during sendEmail');
        return apiError('Please try again after 15 minutes.', 500);
      }

      if (emailResponse.success) {
        return apiResponse({ message: 'OTP sent to your new email address.' });
      } else {
        logger.error({ message: emailResponse.message }, '[MAIL FAILURE] sendEmail returned false');
        return apiError('Please try again after 15 minutes.', 500);
      }
    } catch (error) {
      logger.error(error, '[GENERAL ERROR] send-update-email-otp');
      return apiError('An internal server error occurred.', 500);
    }
  } catch (outerError) {
    logger.error(outerError, '[CRITICAL ERROR] send-update-email-otp rate limit check');
    return apiError('Internal Server Error', 500);
  }
}
