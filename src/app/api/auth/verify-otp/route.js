import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // Assuming your db utility is here

export async function POST(request) {
  try {
    const { rollNo, submittedOtp } = await request.json();

    if (!rollNo || !submittedOtp) {
      return NextResponse.json({ success: false, message: 'Roll number and OTP are required' }, { status: 400 });
    }

    // Fetch stored OTP from database
    const [storedOtpRecord] = await query('SELECT otp_code, expires_at FROM otp_codes WHERE roll_no = ?', [rollNo]);

    if (!storedOtpRecord) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP.' }, { status: 400 });
    }

    const { otp_code, expires_at } = storedOtpRecord;

    if (new Date() > new Date(expires_at)) {
      // OTP expired, delete it from the database
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return NextResponse.json({ success: false, message: 'OTP has expired.' }, { status: 400 });
    }

    if (submittedOtp === otp_code) {
      // OTP is valid and not expired, delete it after successful verification
      await query('DELETE FROM otp_codes WHERE roll_no = ?', [rollNo]);
      return NextResponse.json({ success: true, message: 'OTP verified successfully.' });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid OTP.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
