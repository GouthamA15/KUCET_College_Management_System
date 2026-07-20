import logger from '@/lib/logger';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Hash an OTP the same way it was stored during send-otp.
 * Must match the hashing in send-otp/route.js.
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

/**
 * Constant-time comparison of two hex digest strings.
 * Prevents timing-oracle attacks that could narrow down valid OTPs.
 */
function safeCompareOtp(submittedOtp, storedHash) {
  const submittedHash = hashOtp(submittedOtp);
  const a = Buffer.from(submittedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  // Must be same length for timingSafeEqual; SHA-256 always produces 32 bytes
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rollNo = body.rollNo || body.rollno;
    const email = body.email;
    const submittedOtp = body.submittedOtp || body.otp;

    const identifier = rollNo || email;

    if (!identifier || !submittedOtp) return apiError('Identifier and OTP are required', 400);

    // ─── FIX #5: Rate limiting — max 5 verify attempts per 10 min per identifier ───
    // Prevents 1-million OTP brute-force enumeration attacks.
    const rateCheck = await checkRateLimit(`verify_otp:${identifier}`, 5, 600); // 5 per 10 min
    if (!rateCheck.success) {
      const retryAfter = rateCheck.resetIn || rateCheck.ttl || rateCheck.reset || 600;
      return NextResponse.json(
        { error: 'Too many verification attempts. Please request a new OTP.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const storedOtpRecord = await db.query.otpCodes.findFirst({
      where: eq(otpCodes.identifier, identifier)
    });

    if (!storedOtpRecord) return apiError('Invalid or expired OTP.', 400);

    const { id, otp_code: storedHash, expires_at } = storedOtpRecord;
    const { getNow } = await import('@/lib/clock');

    if (getNow() > new Date(expires_at)) {
      await db.delete(otpCodes).where(eq(otpCodes.id, id));
      return apiError('OTP has expired.', 400);
    }

    // ─── FIX #6: Constant-time comparison via crypto.timingSafeEqual ───
    // ─── FIX #4: OTP was stored as plaintext; send-otp now stores SHA-256(otp) ───
    // Both sides must use the same hashing — verify hashes the submission and compares.
    if (safeCompareOtp(submittedOtp, storedHash)) {
      // Single-use: delete immediately upon successful verification
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
