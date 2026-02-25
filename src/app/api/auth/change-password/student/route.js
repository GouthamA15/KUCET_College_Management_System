import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const [student] = await query('SELECT password_hash FROM students WHERE roll_no = ?', [user.roll_no]);

    if (!student) {
      return apiError('Student not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, student.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await query('UPDATE students SET password_hash = ? WHERE roll_no = ?', [hashedPassword, user.roll_no]);

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
