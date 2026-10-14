import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentReactivationRequests } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import { z } from 'zod';

const reactivateSchema = z.object({
  roll_no: z.string().trim().min(3),
  email: z.string().trim().email(),
  reason: z.string().trim().min(10, 'Please provide a detailed explanation (minimum 10 characters)').max(1000)
});

export async function POST(request) {
  try {
    const body = await request.json();
    const validated = reactivateSchema.parse(body);
    const { roll_no, email, reason } = validated;

    // Find student
    const [student] = await db.select({
      id: students.id,
      roll_no: students.roll_no,
      email: students.email,
      student_status: students.student_status
    })
    .from(students)
    .where(and(
      eq(students.roll_no, roll_no.toUpperCase()),
      eq(students.email, email.toLowerCase())
    ))
    .limit(1);

    if (!student) {
      return apiError('Student record matching this Roll Number and Email was not found.', 404);
    }

    if (student.student_status === 'ACTIVE') {
      return apiError('Your student account is already active. Reactivation is not required.', 400);
    }

    if (student.student_status !== 'INACTIVE_ATTENDANCE') {
      return apiError(`Cannot request reactivation for account status: ${student.student_status}. Please contact the college administration.`, 403);
    }

    // Check if duplicate pending
    const existing = await db.query.studentReactivationRequests.findFirst({
      where: and(
        eq(studentReactivationRequests.student_id, student.id),
        inArray(studentReactivationRequests.status, ['PENDING_HOD', 'PENDING_ADMIN'])
      )
    });

    if (existing) {
      return apiError('A reactivation request is already under review for your account.', 409);
    }

    const [result] = await db.insert(studentReactivationRequests).values({
      student_id: student.id,
      reason,
      status: 'PENDING_HOD'
    });

    return apiResponse({
      success: true,
      request_id: result.insertId,
      message: 'Reactivation request submitted successfully. It will be reviewed by your Department HOD and College Administration.'
    }, 201);
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error creating reactivation request:', err);
    return apiError('Internal Server Error', 500);
  }
}
