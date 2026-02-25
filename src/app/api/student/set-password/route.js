import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

// GET: Check if password is set
export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const rollno = searchParams.get('rollno');

    if (user.roll_no !== rollno) {
        return apiError('Forbidden', 403);
    }

    if (!rollno) return apiError('Roll number required', 400);

    const rows = await query(
      'SELECT password_hash FROM students WHERE roll_no = ?',
      [rollno]
    );

    if (rows.length === 0) return apiError('Student not found', 404);

    const isPasswordSet = !!rows[0].password_hash;

    return apiResponse({ isPasswordSet });
  } catch (err) {
    console.error(err);
    return apiError('Server error', 500);
  }
}

// POST: Set new password
export async function POST(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { rollno, password } = body;

    if (user.roll_no !== rollno) {
        return apiError('Forbidden', 403);
    }

    if (!rollno || !password) {
      return apiError('Missing details', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await query(
      'UPDATE students SET password_hash = ?, is_email_verified = 1 WHERE roll_no = ?',
      [hashedPassword, rollno]
    );

    return apiResponse({ success: true, message: 'Password set successfully' });
  } catch (err) {
    console.error('Password set error:', err);
    return apiError('Server error', 500);
  }
}