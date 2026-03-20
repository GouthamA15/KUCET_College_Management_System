import logger from '@/lib/logger';
import { db } from '@/db';
import { students, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBaseUrl, sendInstitutionalEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';

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

    if (!student) {
      return apiError('Student not found', 404, { is_email_verified: false, has_password_set: false });
    }

    return apiResponse({ 
      is_email_verified: student.is_email_verified,
      has_password_set: !!student.password_hash 
    });
  } catch (error) {
    logger.error('FORGOT PASSWORD STATUS ERROR:', error);
    return apiError('Internal server error', 500, { is_email_verified: false, has_password_set: false });
  }
}

export async function POST(req) {
  try {
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

    if (!student) {
      return apiError('Student not found', 404, { can_dob_login: false });
    }

    if (!student.is_email_verified || !student.password_hash) {
      return apiError('Password reset not available.Because you not set your password and verify your gmail!! Please login using your Date of Birth has a password in (DD-MM-YYYY) format or contact support.', 403, { can_dob_login: true });
    }

    // Generate raw token and store only its SHA-256 hash in DB
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db.insert(passwordResetTokens).values({
      token_hash: tokenHash,
      user_id: rollno,
      user_type: 'student',
      expires_at: expires_at,
      used_at: null
    });

    const baseUrl = getBaseUrl();
    const resetLink = `${baseUrl}/reset-password/${token}`;

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

    await sendInstitutionalEmail({
      to: student.email,
      subject,
      title,
      bodyHtml,
      bodyText,
      action: {
        url: resetLink,
        label: 'Reset Password',
        expiresIn: '10 minutes'
      }
    });

    return apiResponse({ message: 'Password reset link sent to your email', can_dob_login: false });
  } catch (error) {
    logger.error('FORGOT PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
