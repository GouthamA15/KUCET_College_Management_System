import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { rollno, otp, email } = await req.json();

    if (!rollno || !otp || !email) {
      return NextResponse.json({ message: 'Missing roll number, OTP, or email' }, { status: 400 });
    }

    const db = getDb();

    // Find the OTP for the given roll number
    const [rows] = await db.execute('SELECT * FROM otp_codes WHERE roll_no = ? AND otp_code = ?', [rollno, otp]);

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Invalid or expired OTP.' }, { status: 400 });
    }

    const otpData = rows[0];

    // Check if the OTP has expired
    if (new Date() > new Date(otpData.expires_at)) {
      // Clean up expired OTP
      await db.execute('DELETE FROM otp_codes WHERE id = ?', [otpData.id]);
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }
    
    // OTP is valid, update the student's email
    await db.execute('UPDATE students SET email = ? WHERE roll_no = ?', [email, rollno]);
    
    // Clean up the used OTP
    await db.execute('DELETE FROM otp_codes WHERE id = ?', [otpData.id]);
    
    return NextResponse.json({ message: 'Email address verified and updated successfully!' }, { status: 200 });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
