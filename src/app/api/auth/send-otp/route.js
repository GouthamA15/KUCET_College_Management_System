import logger from '@/lib/logger';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendInstitutionalEmail } from '@/lib/email';
import { getStudentEmail } from '@/lib/student-utils';
import { checkRateLimit } from '@/lib/rate-limit';

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
    const body = await request.json();
    const rollNo = body.rollNo || body.rollno;
    const email = body.email;
    const purpose = body.purpose;
    
    const identifier = rollNo || email;
    
    if (!identifier) return apiError('Identifier (Roll number or Email) is required', 400);

    // Resolve client IP with proper validation
    let clientIp = request.ip;
    if (!clientIp) {
      const xForwardedFor = request.headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        // Use only the leftmost entry and validate it
        const firstIp = ips[0];
        // Check for both IPv4 and IPv6 using simple patterns
        const isValidIp = /^[\da-fA-F.:]+$/.test(firstIp) && firstIp.length > 0;
        clientIp = isValidIp ? firstIp : (`req-${crypto.randomBytes(8).toString('hex')}`);
      } else {
        clientIp = `req-${crypto.randomBytes(8).toString('hex')}`;
      }
    }

    // Check identifier-based rate limit FIRST to avoid charging IP counter when identifier is blocked
    const identifierRateCheck = await checkRateLimit(`send_otp_id:${identifier}`, 3, 600); // 3 attempts per 10 min
    if (!identifierRateCheck.success) {
      const retryAfter = identifierRateCheck.resetIn || identifierRateCheck.ttl || identifierRateCheck.reset || 900;
      return NextResponse.json(
        { error: 'Too many OTP requests for this account. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // Then check IP-based rate limit
    const rateCheck = await checkRateLimit(`send_otp_ip:${clientIp}`, 3, 600); // Strict 3 attempts per 10 min per IP
    if (!rateCheck.success) {
      const retryAfter = rateCheck.resetIn || rateCheck.ttl || rateCheck.reset || 900;
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    let targetEmail = email;
    if (rollNo && !email) {
      targetEmail = await getStudentEmail(rollNo);
    }
    
    if (!targetEmail) return apiError('Destination email not found.', 404);

    const otp = generateSecureOtp();

    // ─── FIX #4: Store only SHA-256(otp) in DB — never plaintext ───
    // The raw OTP is sent to the user's email only; the DB holds just its hash.
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const { getNow } = await import('@/lib/clock');
    const now = getNow();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    try {
      await db.delete(otpCodes).where(eq(otpCodes.identifier, identifier));
      await db.insert(otpCodes).values({
        identifier: identifier,
        otp_code: otpHash,   // stored as hash, NOT plaintext
        expires_at: expiresAt
      });
    } catch (dbError) {
      logger.error('Error storing OTP:', dbError);
      return apiError(`Failed to store OTP: ${dbError.message}`, 500);
    }

    const subject = 'KUCET One-Time Password (OTP)';
    const _title = purpose || 'OTP for Verification';
    const bodyHtml = `
      <p>Dear User,</p>
      <p>Please use the One-Time Password (OTP) provided below to complete your verification.</p>
      <p style="margin-top: 12px; font-weight: 600; font-size: 18px;">OTP: ${otp}</p>
      <p>This OTP is valid for the next 5 minutes. Do not share this code with anyone.</p>
    `;

    const { Queue } = await import('@/lib/queue');
    const emailResult = await Queue.enqueueEmail(targetEmail, subject, bodyHtml);

    if (!emailResult || emailResult.success === false) {
      await sendInstitutionalEmail({ to: targetEmail, subject, bodyHtml });
    }

    return apiResponse({ success: true, message: 'OTP sent successfully to your email.' });
  } catch (error) {
    logger.error('Error in send-otp API:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
