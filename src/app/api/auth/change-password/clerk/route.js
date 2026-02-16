import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const [clerk] = await query('SELECT password_hash FROM clerks WHERE email = ?', [user.email]);

    if (!clerk) {
      return apiError('Clerk not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, clerk.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await query('UPDATE clerks SET password_hash = ? WHERE email = ?', [hashedPassword, user.email]);

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
