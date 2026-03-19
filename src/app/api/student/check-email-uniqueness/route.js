import { db } from '@/db';
import { students } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);
    
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const currentRollno = searchParams.get('currentRollno');

    if (!email) return apiError('Email is required', 400);

    const conditions = [eq(students.email, email)];
    if (currentRollno) {
      conditions.push(ne(students.roll_no, currentRollno));
    }

    const rows = await db.select({ roll_no: students.roll_no })
      .from(students)
      .where(and(...conditions))
      .limit(1);

    if (rows.length > 0) {
      return apiResponse({ isUnique: false, message: 'This email is already registered to another student.' });
    }

    return apiResponse({ isUnique: true, message: 'Email is available.' });
  } catch (error) {
    console.error('Error checking email uniqueness:', error);
    return apiError('Server error', 500);
  }
}
