import logger from '@/lib/logger';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    const student = await db.query.students.findFirst({
      columns: { password_hash: true },
      where: eq(students.roll_no, rollno)
    });

    if (!student) return apiError('Student not found', 404);

    const isPasswordSet = !!student.password_hash;

    return apiResponse({ isPasswordSet });
  } catch (err) {
    logger.error(err);
    return apiError('Server error', 500);
  }
}

// POST: Set new password
export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { rollno, password, currentPassword } = body;

    if (user.roll_no !== rollno) {
        return apiError('Forbidden', 403);
    }

    if (!rollno || !password) {
      return apiError('Missing details', 400);
    }

    // Check if student already has a password
    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, rollno),
      columns: { id: true, password_hash: true }
    });

    if (!student) return apiError('Student not found', 404);

    let eventType = 'PASSWORD_CREATED';

    if (student.password_hash) {
      if (!currentPassword) {
        return apiError('Current password is required to change your password.', 400);
      }

      const match = await bcrypt.compare(currentPassword, student.password_hash);
      if (!match) {
        return apiError('Current password is incorrect.', 400);
      }

      if (currentPassword === password) {
        return apiError('New password must be different from the current password.', 400);
      }
      
      eventType = 'PASSWORD_CHANGED';
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const now = (await import('@/lib/clock')).getNow();
    await db.update(students)
      .set({ 
        password_hash: hashedPassword, 
        is_email_verified: true,
        password_changed_at: now
      })
      .where(eq(students.roll_no, rollno));

    // Log Security Event
    const SecurityService = (await import('@/services/SecurityService')).default;
    await SecurityService.logSecurityEvent({
      userType: 'STUDENT',
      userId: student.id,
      eventType: eventType,
      ipAddress: ip
    });

    const updatedStudent = await db.query.students.findFirst({
      where: eq(students.roll_no, rollno)
    });

    const response = apiResponse({ success: true, message: `Password ${eventType === 'PASSWORD_CREATED' ? 'set' : 'changed'} successfully` });
    const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
    await issueStudentAuthCookie(response, updatedStudent);

    return response;
  } catch (err) {
    logger.error('Password set error:', err);
    return apiError('Server error', 500);
  }
}
