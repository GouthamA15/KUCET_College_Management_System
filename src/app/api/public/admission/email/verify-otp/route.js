import logger from '@/lib/logger';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { SignJWT } from 'jose';
import crypto from 'crypto';

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
}

function safeCompareOtp(submittedOtp, storedHash) {
  const submittedHash = hashOtp(submittedOtp);
  const a = Buffer.from(submittedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload.', 400);
    }

    const { email, otp } = body || {};

    if (!email || typeof email !== 'string' || !otp || typeof otp !== 'string') {
      return apiError('Email and verification code are required.', 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return apiError('Verification code must be a 6-digit number.', 400);
    }

    const identifier = `admission:${cleanEmail}`;

    // 1. Rate limit verification attempts (Max 5 attempts per 10 min to prevent brute force)
    const rateCheck = await checkRateLimit(`admission_verify_attempt:${cleanEmail}`, 5, 600);
    if (!rateCheck.success) {
      return apiError('Too many failed verification attempts. Please request a new verification code.', 429);
    }

    // 2. Fetch stored OTP record by admission-specific identifier
    const storedRecord = await db.query.otpCodes.findFirst({
      where: eq(otpCodes.identifier, identifier),
    });

    if (!storedRecord) {
      return apiError('Invalid or expired verification code. Please request a new code.', 400);
    }

    // 3. Expiration verification
    if (new Date() > new Date(storedRecord.expires_at)) {
      await db.delete(otpCodes).where(eq(otpCodes.id, storedRecord.id));
      return apiError('Verification code has expired. Please request a new code.', 400);
    }

    // 4. Constant-time cryptographic comparison
    if (!safeCompareOtp(cleanOtp, storedRecord.otp_code)) {
      return apiError('Invalid verification code.', 400);
    }

    // 5. Single-use consumption (prevent replay of consumed OTP)
    await db.delete(otpCodes).where(eq(otpCodes.id, storedRecord.id));

    // 6. Issue cryptographically signed verification token
    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET must be configured in production environment.');
      }
      jwtSecret = 'temporary_admission_secret_at_least_32_chars!';
    }
    const secret = new TextEncoder().encode(jwtSecret);

    const verificationToken = await new SignJWT({
      verifiedEmail: cleanEmail,
      purpose: 'student_admission_email',
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);

    return apiResponse({
      success: true,
      message: 'Email address verified successfully.',
      verificationToken,
    });
  } catch (error) {
    logger.error(error, '[ADMISSION_VERIFY_OTP_ERROR]');
    return apiError('Internal server error during OTP verification.', 500);
  }
}
