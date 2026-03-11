import { getDb } from '@/lib/db';
import { sendInstitutionalEmail } from '@/lib/email';
import crypto from 'crypto';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`otp_send:${ip}`, 3, 3600); // 3 per hour
    
    if (!rateCheck.success) {
      return apiError('Too many OTP requests. Please try again in an hour.', 429);
    }

    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    try {
      const body = await req.json();
      const rollno = body.rollno;
      const rawEmail = body.email ? String(body.email) : '';
      // Aggressive cleaning: Remove all whitespace and non-standard characters
      const email = rawEmail.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9@.\-_]/g, '');

      console.log(`[DEBUG] OTP Request: rollno=${rollno}, rawEmail="${rawEmail}", cleanedEmail="${email}"`);

      if (!rollno || !email) {
        return apiError('Missing roll number or email', 400);
      }

      const db = getDb();

      // Server-side email uniqueness check
      const uniquenessQuery = 'SELECT roll_no FROM students WHERE email = ? AND roll_no != ?';
      const uniquenessParams = [email, rollno];
      const [existingEmailRows] = await db.execute(uniquenessQuery, uniquenessParams);

      if (existingEmailRows.length > 0) {
        return apiError('This email is already registered to another student.', 409);
      }
      
      // Generate a secure 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

      // Build an absolute URL to public assets so images render in email clients
      const forwardedProto = req.headers.get('x-forwarded-proto') || req.headers.get('x-forwarded-protocol');
      const referer = req.headers.get('referer');
      let proto = forwardedProto || 'https';
      try {
        if (!forwardedProto && referer) proto = new URL(referer).protocol.replace(':', '');
      } catch (e) {
        // ignore and fall back to default
      }
      const host = req.headers.get('host') || process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000';
      const baseUrl = host.startsWith('http') ? host : `${proto}://${host}`;

      const campusUrl = `${baseUrl}/assets/college-campus.jpg`;

      // Invalidate any existing OTPs for this roll number
      try {
        await db.execute('DELETE FROM otp_codes WHERE roll_no = ?', [rollno]);

        // Store the new OTP
        await db.execute(
          'INSERT INTO otp_codes (roll_no, otp_code, expires_at) VALUES (?, ?, ?)',
          [rollno, otp, expiresAt]
        );
      } catch (dbError) {
        console.error('[DATABASE ERROR] OTP management failed:', dbError);
        return apiError('Database error occurred during OTP generation.', 500);
      }

      // Send the OTP email using the shared institutional template
      const subject = 'Verify Your New Email Address';
      const bodyHtml = `
        <p style="margin:0 0 12px 0;font-size:15px;color:#111827;">Hello,</p>
        <p style="margin:0 0 18px 0;font-size:14px;color:#374151;">Use the secure One-Time Password (OTP) below to verify your new email address for your student portal account.</p>

        <div style="text-align:center;margin:18px 0;">
          <div style="display:inline-block;padding:16px 26px;border-radius:8px;background:linear-gradient(180deg,#ffffff,#f7f9fb);border:1px solid #e6e9ee;">
            <div style="font-size:26px;letter-spacing:4px;font-weight:700;color:#0b5ed7;">${otp}</div>
          </div>
        </div>

        <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">This OTP will expire in <strong>10 minutes</strong>. For your security, do not share this code with anyone.</p>
        <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">If you did not request this change, please contact the admissions office immediately.</p>

        <div style="padding-top:18px;">
          <img src="${campusUrl}" alt="Campus" style="width:100%;height:auto;border-radius:6px;display:block;margin-top:12px;" />
        </div>
      `;

      let emailResponse;
      try {
        emailResponse = await sendInstitutionalEmail({
          to: email,
          subject,
          title: 'OTP for Email Change Verification',
          bodyHtml: bodyHtml,
          // bodyText will be derived from HTML by the helper
        });
      } catch (mailError) {
        console.error('[MAIL EXCEPTION] Failed during sendEmail:', mailError);
        return apiError('Email service exception occurred.', 500);
      }

      if (emailResponse.success) {
        return apiResponse({ message: 'OTP sent to your new email address.' });
      } else {
        console.error('[MAIL FAILURE] sendEmail returned false:', emailResponse.message);
        return apiError(emailResponse.message || 'Failed to send OTP email.', 500);
      }
    } catch (error) {
      console.error('[GENERAL ERROR] send-update-email-otp:', error);
      return apiError('An internal server error occurred.', 500);
    }
  } catch (outerError) {
    console.error('[CRITICAL ERROR] send-update-email-otp rate limit check:', outerError);
    return apiError('Internal Server Error', 500);
  }
}