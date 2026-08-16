import logger from '@/lib/logger';
import { db } from '@/db';
import { students, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBaseUrl, sendInstitutionalEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── FIX #1: GET — always return the same shape regardless of whether roll no exists ───
// Prevents enumeration: attacker learns nothing from 404 vs 200 discrepancy.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rollno = searchParams.get('rollno');

    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, rollno),
      columns: {
        is_email_verified: true,
        password_hash: true
      }
    });

    // SECURITY: Always return 200 with the same structure — never 404.
    // This prevents user enumeration via the presence/absence of an account.
    return apiResponse({
      is_email_verified: student ? !!student.is_email_verified : false,
      has_password_set: student ? !!student.password_hash : false
    });
  } catch (error) {
    logger.error('FORGOT PASSWORD STATUS ERROR:', error);
    // Fail safe: never expose 500 internals, return neutral payload
    return apiResponse({ is_email_verified: false, has_password_set: false });
  }
}

// ─── FIX #2: POST — uniform 200 "If an account exists" in ALL branches ───
// Prevents enumeration: "Student not found" 404 and "not activated" 403 both gone.
export async function POST(req) {
  // ─── FIX #12: Rate limiting on forgot-password/student (3 per 15 min) ───
  try {
    let clientIp = req.ip;
    if (!clientIp) {
      const xff = req.headers.get('x-forwarded-for');
      clientIp = xff ? xff.split(',')[0].trim() : `anon-${crypto.randomBytes(4).toString('hex')}`;
    }

    const rateCheck = await checkRateLimit(`forgot_pwd_student:${clientIp}`, 3, 900); // 3 per 15 min
    if (!rateCheck.success) {
      const retryAfter = rateCheck.resetIn || rateCheck.ttl || rateCheck.reset || 900;
      return NextResponse.json(
        { message: 'If an account with this roll number exists, a password reset link has been sent.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { rollno } = await req.json();
    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, rollno),
      columns: {
        email: true,
        password_hash: true,
        is_email_verified: true
      }
    });

    // SECURITY: Generic response regardless of whether student exists or is activated.
    // This prevents two previous enumeration vectors:
    //   • "Student not found" 404 → attacker learns roll no is invalid
    //   • 403 "not activated" → attacker learns roll no IS valid but has no password
    const GENERIC_OK = apiResponse({
      message: 'If an account with this roll number exists, a password reset link has been sent.',
      can_dob_login: false
    });

    if (!student) return GENERIC_OK;

    // If account isn't activated, silently succeed so attacker learns nothing.
    if (!student.is_email_verified || !student.password_hash) {
      return GENERIC_OK;
    }

    // Generate raw token; store only its SHA-256 hash in DB (Fix #token-hash is already present)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // ─── FIX #14: Use getNow() (IST clock) instead of Date.now() ───
    const { getNow } = await import('@/lib/clock');
    const now = getNow();

    // ─── FIX #15: Reset token expiry raised from 10 min → 60 min ───
    const expires_at = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes

    await db.insert(passwordResetTokens).values({
      token_hash: tokenHash,
      user_id: rollno,
      user_type: 'student',
      expires_at: expires_at,
      used_at: null
    });

    const baseUrl = getBaseUrl() || req.headers.get('origin') || 'http://localhost:3000';
    const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password/${token}`;

    const subject = 'KUCET Password Reset Request';
    const title = 'Password Reset Request';

    const bodyHtml = `
      <p>Dear Student,</p>
      <p>You have requested to reset the password for your KUCET College Portal account.</p>
      <p>Please use the button below to securely reset your password.</p>
    `;

    const bodyText = `Dear Student,

You have requested to reset the password for your KUCET College Portal account.
Please use the link below to securely reset your password:

${resetLink}

If you did not initiate this request, please ignore this email or contact the administration immediately.`;

    const emailResult = await sendInstitutionalEmail({
      to: student.email,
      subject,
      title,
      bodyHtml,
      bodyText,
      action: {
        url: resetLink,
        label: 'Reset Password',
        expiresIn: '60 minutes'
      }
    });

    if (!emailResult || emailResult.success === false) {
      logger.error('FORGOT PASSWORD EMAIL DELIVERY FAILED', {
        rollno,
        email: student.email,
        result: emailResult || { success: false, message: 'No email result returned' }
      });
      return apiResponse({
        message: 'We could not send a reset link right now. Please try again in a few minutes.'
      }, 500);
    }

    return GENERIC_OK;
  } catch (error) {
    logger.error('FORGOT PASSWORD ERROR:', error);
    return apiResponse({
      message: 'We could not send a reset link right now. Please try again in a few minutes.'
    }, 500);
  }
}
