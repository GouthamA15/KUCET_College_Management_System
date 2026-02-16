import { query } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { apiResponse, apiError } from '@/lib/api-utils';
import crypto from 'crypto';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rollno = searchParams.get('rollno');

    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const [student] = await query('SELECT is_email_verified, password_hash FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return apiError('Student not found', 404, { is_email_verified: false, has_password_set: false });
    }

    return apiResponse({ 
      is_email_verified: student.is_email_verified === 1,
      has_password_set: !!student.password_hash 
    });
  } catch (error) {
    console.error('FORGOT PASSWORD STATUS ERROR:', error);
    return apiError('Internal server error', 500, { is_email_verified: false, has_password_set: false });
  }
}

export async function POST(req) {
  try {
    const { rollno } = await req.json();
    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const [student] = await query('SELECT email, password_hash, is_email_verified FROM students WHERE roll_no = ?', [rollno]);

    if (!student) {
      return apiError('Student not found', 404, { can_dob_login: false });
    }

    if (!student.is_email_verified || !student.password_hash) {
      return apiError('Password reset not available.Because you not set your password and verify your gmail!! Please login using your Date of Birth has a password in (DD-MM-YYYY) format or contact support.', 403, { can_dob_login: true });
    }

    // Generate raw token and store only its SHA-256 hash in DB
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const created_at = new Date();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await query(
      'INSERT INTO password_reset_tokens (token_hash, user_id, user_type, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)',
      [tokenHash, rollno, 'student', created_at, expires_at]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password/${token}`;
    
    const subject = 'KUCET Password Reset Request';
    const html = `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                  <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                  <p><a href="${resetLink}">${resetLink}</a></p>
                  <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail(student.email, subject, html);

    return apiResponse({ message: 'Password reset link sent to your email', can_dob_login: false });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
