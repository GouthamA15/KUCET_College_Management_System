import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { getStudentEmail } from '@/lib/student-utils';
import { query } from '@/lib/db'; // Assuming your db utility is here

// Helper to generate a secure 6-digit numeric OTP
function generateSecureOtp() {
  const length = 6;
  const min = Math.pow(10, length - 1); // 100000
  const max = Math.pow(10, length) - 1; // 999999
  const randomNumber = crypto.randomBytes(4).readUInt32LE(0); // 4 bytes = 32 bits of randomness
  const numericOtp = (min + (randomNumber % (max - min + 1))).toString();
  return numericOtp.padStart(length, '0');
}

export async function POST(request) {
  try {
    const { rollNo } = await request.json();

    if (!rollNo) {
      return NextResponse.json({ success: false, message: 'Roll number is required' }, { status: 400 });
    }

    const studentEmail = await getStudentEmail(rollNo);
    if (!studentEmail) {
      return NextResponse.json({ success: false, message: 'Student email not found.' }, { status: 404 });
    }

    const otp = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // --- Database Interaction to store OTP ---
    try {
      // Invalidate any previous OTPs for this roll_no (good practice for upsert)
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      // Store the new OTP
      await query(
        'INSERT INTO otp_codes (roll_no, otp_code, expires_at) VALUES (?, ?, ?)',
        [rollNo, otp, expiresAt.toISOString()]
      );
    } catch (dbError) {
      console.error('Error storing OTP in database:', dbError);
      return NextResponse.json({ success: false, message: 'Failed to store OTP.' }, { status: 500 });
    }
    // --- End Database Interaction ---

    const subject = 'KUCET OTP for Verification';
    const html = `<html>
      <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(16,24,40,0.06);">
                <tr>
                  <td style="padding:20px 24px;text-align:center;background:#0b5ed7;color:#ffffff;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                      <img src="cid:ku_logo@kucet" alt="KU College Logo" style="height:56px;display:block;" />
                      <div style="text-align:left;">
                        <div style="font-size:16px;font-weight:700;line-height:1;color:#ffffff;">Kakatiya University - College Portal</div>
                        <div style="font-size:12px;opacity:0.9;margin-top:2px;">One-Time Password (OTP) Verification</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px 0;font-size:15px;color:#111827;">Dear Student,</p>
                    <p style="margin:0 0 18px 0;font-size:15px;color:#374151;">Please use the secure One-Time Password (OTP) below to complete your verification.</p>

                    <div style="text-align:center;margin:18px 0;">
                      <div style="display:inline-block;padding:18px 28px;border-radius:8px;background:linear-gradient(180deg,#ffffff,#f3f4f6);border:1px solid #e6e9ee;">
                        <div style="font-size:28px;letter-spacing:4px;font-weight:700;color:#0b5ed7;">${otp}</div>
                      </div>
                    </div>

                    <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;">This OTP is valid for the next <strong>5 minutes</strong>. Do not share this code with anyone.</p>
                    <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">If you did not request this, you can safely ignore this email. The code will expire automatically.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 18px 24px;">
                    <img src="cid:campus@kucet" alt="KUCET Campus" style="width:100%;height:auto;border-radius:6px;display:block;" />
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:14px 24px;text-align:center;font-size:12px;color:#6b7280;">
                    <div style="margin-bottom:6px;">Regards,<br/>Admissions Team — KUCET</div>
                    <div style="opacity:0.9;">Kakatiya University, Warangal</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px;text-align:center;font-size:11px;color:#9ca3af;">
                    <img src="cid:thoranam@kucet" alt="Kakatiya Kala Thoranam" style="height:36px;opacity:0.9;margin-top:6px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

    const emailResult = await sendEmail(studentEmail, subject, html);

    if (emailResult.success) {
      return NextResponse.json({ success: true, message: 'OTP sent successfully to your email.' });
    } else {
      console.error('Failed to send OTP email:', emailResult.message);
      // Optionally delete OTP from DB if email sending failed, to prevent stale OTPs
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return NextResponse.json({ success: false, message: emailResult.message || 'Failed to send OTP email.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in send-otp API:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
