import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';
import { SignJWT } from 'jose';
import bcrypt from'bcrypt'

export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, dob, rememberMe } = body; //dob used as password input field
    if (!rollno || !dob) {
      return apiError('Missing rollno or dob', 400);
    }
    
    const rows = await query(
      `SELECT s.id, s.roll_no, s.name, sp.father_name, sp.category, s.mobile, s.date_of_birth, s.password_hash
       FROM students s
       LEFT JOIN student_personal_details sp ON s.id = sp.student_id
       WHERE s.roll_no = ?`,
      [rollno]
    );

    if (rows.length === 0) {
      return apiError('Student not found', 404);
    }

    const student = rows[0];
    let isAuthenticated = false

    // 1. CHECK PASSWORD (If set)
    if (student.password_hash) {
      // The user entered a password in the 'dob' field
      const match = await bcrypt.compare(dob, student.password_hash);
      if (match) {
        isAuthenticated = true;
      } else {
        return apiError('Invalid Password', 401);
      }
    }
    else {
    const dbDate = new Date(student.date_of_birth);
    const dbDateString = dbDate.getFullYear() + '-' + String(dbDate.getMonth() + 1).padStart(2, '0') + '-' + String(dbDate.getDate()).padStart(2, '0');
    // Helper: Normalize Input to YYYY-MM-DD
      // This handles if frontend sends "15-08-2005" OR "2005-08-15"
      let inputDateString = dob;
      if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts[0].length === 2 && parts[2].length === 4) {
           // It's DD-MM-YYYY -> Convert to YYYY-MM-DD
           inputDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

    if (dbDateString === inputDateString) {
        isAuthenticated = true;
      } else {
        return apiError('Invalid Date of Birth', 401);
      }
    }

    if (!isAuthenticated) {
        return apiError('Authentication failed', 401);
    }
    
    const { date_of_birth: _dob, password_hash = _ph, ...profile } = student;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const sessionDuration = rememberMe ? '30d' : '1h';
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 60 * 60;

    const token = await new SignJWT({ student_id: student.id, roll_no: student.roll_no, name: student.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionDuration)
      .sign(secret);

    const response = apiResponse({ student: profile, success: true });

    // Clear other auth cookies
    response.cookies.delete('admin_auth');
    response.cookies.delete('clerk_auth');

    response.cookies.set('student_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: cookieMaxAge,
        path: '/',
    });
    return response;

  } catch (err) {
     console.error(err)
    return apiError('Server error', 500, err.message);
  }
}
