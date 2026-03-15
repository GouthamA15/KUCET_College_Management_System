import { getDb, query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`otp_verify:${ip}`, 5, 900); // 5 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many verification attempts. Please try again in 15 minutes.', 429);
    }

    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }
    
    try {
      const { rollno, otp, email } = await req.json();

      if (!rollno || !otp || !email) {
        return apiError('Missing roll number, OTP, or email', 400);
      }

      const db = getDb();

      // Find the OTP for the given roll number
      const [rows] = await db.execute('SELECT * FROM otp_codes WHERE roll_no = ? AND otp_code = ?', [rollno, otp]);

      if (rows.length === 0) {
        return apiError('Invalid or expired OTP.', 400);
      }

      const otpData = rows[0];

      // Check if the OTP has expired
      if (new Date() > new Date(otpData.expires_at)) {
        // Clean up expired OTP
        await db.execute('DELETE FROM otp_codes WHERE id = ?', [otpData.id]);
        return apiError('OTP has expired. Please request a new one.', 400);
      }
      
      // OTP is valid, update the student's email and mark it verified
      await db.execute('UPDATE students SET email = ?, is_email_verified = ?, email_verified_at = ? WHERE roll_no = ?', [email, true, new Date(), rollno]);
      
      // Clean up the used OTP
      await db.execute('DELETE FROM otp_codes WHERE id = ?', [otpData.id]);

      // Fetch updated student data to re-issue cookie
      const [updatedRows] = await db.execute('SELECT * FROM students WHERE roll_no = ?', [rollno]);
      const updatedStudent = updatedRows[0];

      const response = apiResponse({ message: 'Email address verified and updated successfully!' });
      const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
      await issueStudentAuthCookie(response, updatedStudent);

      return response;

    } catch (error) {
      console.error('Verify OTP Error:', error);
      return apiError('An internal server error occurred.', 500);
    }
  } catch (outerError) {
    console.error('[CRITICAL] Verify OTP Rate Limit/Auth Error:', outerError);
    return apiError('Internal Server Error', 500);
  }
}