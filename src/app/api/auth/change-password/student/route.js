import logger from '@/lib/logger';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, user.roll_no),
      columns: {
        password_hash: true
      }
    });

    if (!student) {
      return apiError('Student not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, student.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.update(students)
      .set({ password_hash: hashedPassword })
      .where(eq(students.roll_no, user.roll_no));

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}
