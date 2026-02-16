import { apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/db'; // Assuming your db utility is here

export async function POST(request) {
  try {
    const { rollNo, submittedOtp } = await request.json();

    if (!rollNo || !submittedOtp) {
      return apiError('Roll number and OTP are required', 400);
    }

    // Fetch stored OTP from database
    const [storedOtpRecord] = await query('SELECT otp_code, expires_at FROM otp_codes WHERE roll_no = ?', [rollNo]);

    if (!storedOtpRecord) {
      return apiError('Invalid or expired OTP.', 400);
    }

    const { otp_code, expires_at } = storedOtpRecord;

    if (new Date() > new Date(expires_at)) {
      // OTP expired, delete it from the database
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return apiError('OTP has expired.', 400);
    }

    if (submittedOtp === otp_code) {
      // OTP is valid and not expired, delete it after successful verification
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return apiResponse({ success: true, message: 'OTP verified successfully.' });
    } else {
      return apiError('Invalid OTP.', 400);
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
