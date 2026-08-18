import { NextResponse } from 'next/server';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendInstitutionalEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, message: 'Valid email is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Delete existing OTPs for this email to prevent spam buildup
    await db.delete(otpCodes).where(eq(otpCodes.identifier, cleanEmail));

    // Store new OTP
    await db.insert(otpCodes).values({
      identifier: cleanEmail,
      otp_code: otp,
      expires_at: expiresAt
    });

    // Send email
    await sendInstitutionalEmail({
      to: cleanEmail,
      subject: 'Staff Registration - Email Verification OTP',
      title: 'Email Verification',
      bodyHtml: `<p>Please use the following One-Time Password (OTP) to verify your email address for staff registration. This code will expire in 15 minutes.</p>
                 <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #f3f4f6; text-align: center; border-radius: 6px; margin: 20px 0;">
                   ${otp}
                 </div>`,
      bodyText: `Your OTP for staff registration is: ${otp}. It will expire in 15 minutes.`,
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('[SEND_OTP_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Internal server error while sending OTP.' }, { status: 500 });
  }
}
