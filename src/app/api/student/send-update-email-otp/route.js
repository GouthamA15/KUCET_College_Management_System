import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function POST(req) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');

  if (!studentAuthCookie || studentAuthCookie.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rollno, email } = await req.json();

    if (!rollno || !email) {
      return NextResponse.json({ message: 'Missing roll number or email' }, { status: 400 });
    }

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    const db = getDb();
    
    // Invalidate any existing OTPs for this roll number
    await db.execute('DELETE FROM otp_codes WHERE roll_no = ?', [rollno]);

    // Store the new OTP
    await db.execute(
      'INSERT INTO otp_codes (roll_no, otp_code, expires_at) VALUES (?, ?, ?)',
      [rollno, otp, expiresAt]
    );

    // Send the OTP email
    const subject = 'Verify Your New Email Address';
    const html = `<html>
      <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(16,24,40,0.06);">
                <tr>
                  <td style="padding:18px 20px;text-align:center;background:#0b5ed7;color:#ffffff;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                      <img src="cid:ku_logo@kucet" alt="KU College Logo" style="height:48px;display:block;" />
                      <div style="text-align:left;">
                        <div style="font-size:15px;font-weight:700;line-height:1;color:#ffffff;">Kakatiya University - College Portal</div>
                        <div style="font-size:12px;opacity:0.95;margin-top:2px;">Email Verification</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px;">
                    <p style="margin:0 0 12px 0;font-size:15px;color:#111827;">Hello,</p>
                    <p style="margin:0 0 18px 0;font-size:14px;color:#374151;">Use the secure One-Time Password (OTP) below to verify your new email address for your student portal account.</p>

                    <div style="text-align:center;margin:18px 0;">
                      <div style="display:inline-block;padding:16px 26px;border-radius:8px;background:linear-gradient(180deg,#ffffff,#f7f9fb);border:1px solid #e6e9ee;">
                        <div style="font-size:26px;letter-spacing:4px;font-weight:700;color:#0b5ed7;">${otp}</div>
                      </div>
                    </div>

                    <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">This OTP will expire in <strong>10 minutes</strong>. For your security, do not share this code with anyone.</p>
                    <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">If you did not request this change, please contact the admissions office immediately.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <img src="cid:campus@kucet" alt="Campus" style="width:100%;height:auto;border-radius:6px;display:block;" />
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:12px 22px;text-align:center;font-size:12px;color:#6b7280;">
                    <div style="margin-bottom:6px;">Regards,<br/>Admissions Team — KUCET</div>
                    <div style="opacity:0.9;">Kakatiya University, Warangal</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 22px;text-align:center;font-size:11px;color:#9ca3af;">
                    <img src="cid:thoranam@kucet" alt="Kakatiya Kala Thoranam" style="height:34px;opacity:0.9;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
    
    const emailResponse = await sendEmail(email, subject, html);

    if (emailResponse.success) {
      return NextResponse.json({ message: 'OTP sent to your new email address.' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Failed to send OTP email.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
