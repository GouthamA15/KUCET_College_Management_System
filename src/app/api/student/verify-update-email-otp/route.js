import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function POST(req) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');
  const token = studentAuthCookie ? studentAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
    
    // OTP is valid, update the student's email and mark it verified
    await db.execute('UPDATE students SET email = ?, is_email_verified = ?, email_verified_at = ? WHERE roll_no = ?', [email, true, new Date(), rollno]);
    
    // Clean up the used OTP
    await db.execute('DELETE FROM otp_codes WHERE id = ?', [otpData.id]);
    
    return NextResponse.json({ message: 'Email address verified and updated successfully!' }, { status: 200 });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
