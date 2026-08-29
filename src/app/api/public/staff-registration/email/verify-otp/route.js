import { NextResponse } from 'next/server';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { SignJWT } from 'jose';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ success: false, message: 'Email and OTP are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check OTP
    const existing = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.identifier, cleanEmail),
        eq(otpCodes.otp_code, otp.trim())
      )).limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid OTP.' }, { status: 400 });
    }

    const otpRecord = existing[0];
    if (new Date() > new Date(otpRecord.expires_at)) {
      await db.delete(otpCodes).where(eq(otpCodes.id, otpRecord.id));
      return NextResponse.json({ success: false, message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Success! Delete the OTP.
    await db.delete(otpCodes).where(eq(otpCodes.id, otpRecord.id));

    // Issue a short-lived cryptographically signed token proving this email is verified
    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') throw new Error('FATAL: JWT_SECRET must be set in production');
      jwtSecret = 'fallback-secret-do-not-use';
    }
    const secret = new TextEncoder().encode(jwtSecret);
    
    const verificationToken = await new SignJWT({ verifiedEmail: cleanEmail, purpose: 'staff_registration_email' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);

    return NextResponse.json({ success: true, verificationToken });
  } catch (error) {
    console.error('[VERIFY_OTP_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Internal server error while verifying OTP.' }, { status: 500 });
  }
}
