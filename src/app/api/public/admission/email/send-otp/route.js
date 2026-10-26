import logger from '@/lib/logger';
import { db } from '@/db';
import { otpCodes, studentAdmissionDrafts, students, staffAccounts } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendInstitutionalEmail, EMAIL_CATEGORIES } from '@/lib/email';
import crypto from 'crypto';

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const maskedLocal = localPart[0] + '*'.repeat(Math.max(localPart.length - 2, 3)) + localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'anonymous';
    
    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload.', 400);
    }

    const { email } = body || {};

    if (!email || typeof email !== 'string') {
      return apiError('A valid email address is required.', 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 255) {
      return apiError('Please provide a valid email address format.', 400);
    }

    // 1. IP Rate Limiting (5 requests per 10 minutes)
    const ipRate = await checkRateLimit(`admission_otp_ip:${ip}`, 5, 600);
    if (!ipRate.success) {
      return apiError('Too many requests from this network. Please try again after 10 minutes.', 429);
    }

    // 2. Email Rate Limiting (3 requests per 10 minutes)
    const emailRate = await checkRateLimit(`admission_otp_email:${cleanEmail}`, 3, 600);
    if (!emailRate.success) {
      return apiError('Too many verification requests for this email. Please try again after 10 minutes.', 429);
    }

    // 3. Pre-flight check: Exclude emails already registered or in active applications
    const [existingDraft, existingStudent, existingStaff] = await Promise.all([
      db.query.studentAdmissionDrafts.findFirst({
        where: and(
          eq(studentAdmissionDrafts.email, cleanEmail),
          ne(studentAdmissionDrafts.status, 'REJECTED')
        ),
      }),
      db.query.students.findFirst({
        where: eq(students.email, cleanEmail),
      }),
      db.query.staffAccounts.findFirst({
        where: eq(staffAccounts.email, cleanEmail),
      }),
    ]);

    if (existingDraft || existingStudent || existingStaff) {
      return apiError('There is already an application or account associated with this email address.', 409);
    }

    // 4. Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 5. Hash OTP using SHA-256 before database storage (never store plaintext OTP)
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration
    const identifier = `admission:${cleanEmail}`;

    // Delete existing OTPs for this admission identifier
    await db.delete(otpCodes).where(eq(otpCodes.identifier, identifier));

    // Store new OTP hash
    await db.insert(otpCodes).values({
      identifier,
      otp_code: otpHash,
      expires_at: expiresAt,
    });

    // 6. Send transactional email via institutional provider
    const bodyHtml = `
      <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">Hello,</p>
      <p style="margin: 0 0 18px 0; font-size: 14px; color: #374151;">
        Thank you for initiating your admission application to <strong>Kakatiya University College of Engineering and Technology (KUCET)</strong>.
      </p>
      <p style="margin: 0 0 18px 0; font-size: 14px; color: #374151;">
        Please use the following One-Time Password (OTP) to verify your email address.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; padding: 14px 32px; border-radius: 8px; background: #f0f4f8; border: 1px solid #d0d7de;">
          <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0b3578; font-family: monospace;">
            ${otp}
          </span>
        </div>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">
        This code is valid for <strong>10 minutes</strong>. For your security, never share this OTP with anyone.
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
        If you did not initiate this application, please ignore this email.
      </p>
    `;

    const emailRes = await sendInstitutionalEmail({
      to: cleanEmail,
      subject: 'KUCET Admission - Email Verification OTP',
      title: 'Student Admission Verification',
      bodyHtml,
      category: EMAIL_CATEGORIES.AUTH_OTP,
    });

    if (!emailRes?.success) {
      logger.error({ email: cleanEmail, error: emailRes?.message }, '[ADMISSION_OTP] Failed to deliver verification email');
      return apiError('Unable to send verification email. Please check the address or try again shortly.', 500);
    }

    return apiResponse({
      success: true,
      message: 'Verification code sent to your email address.',
      maskedEmail: maskEmail(cleanEmail),
    });
  } catch (error) {
    logger.error(error, '[ADMISSION_SEND_OTP_ERROR]');
    return apiError('Internal server error while sending verification code.', 500);
  }
}
