import logger from '@/lib/logger';
import { db } from '@/db';
import { makeupClassExceptions, facultySubjectAssignments } from '@/db/schema';
import { eq, and, desc, or, isNull } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { z } from 'zod';

const createExceptionSchema = z.object({
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
  exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session_number: z.preprocess(v => (v !== null && v !== undefined && v !== '' ? Number(v) : null), z.number().int().min(1).max(8).nullable().optional()),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500)
});

export async function GET(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id') ? Number(searchParams.get('assignment_id')) : null;

    const conditions = [];
    if (assignmentId) {
      conditions.push(eq(makeupClassExceptions.assignment_id, assignmentId));
    }

    const exceptions = await db.select({
      id: makeupClassExceptions.id,
      assignment_id: makeupClassExceptions.assignment_id,
      exception_date: makeupClassExceptions.exception_date,
      session_number: makeupClassExceptions.session_number,
      reason: makeupClassExceptions.reason,
      authorized_by_staff_id: makeupClassExceptions.authorized_by_staff_id,
      created_at: makeupClassExceptions.created_at,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch
    })
    .from(makeupClassExceptions)
    .innerJoin(facultySubjectAssignments, eq(makeupClassExceptions.assignment_id, facultySubjectAssignments.id))
    .where(and(...conditions))
    .orderBy(desc(makeupClassExceptions.created_at));

    // Branch scoping for HOD
    const filtered = (user.role !== 'admin' && user.branch)
      ? exceptions.filter(e => e.branch === user.branch)
      : exceptions;

    return apiResponse({ data: filtered });
  } catch (err) {
    logger.error('Error fetching makeup exceptions:', err);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const validated = createExceptionSchema.parse(body);
    const { assignment_id, exception_date, session_number, reason } = validated;

    // Verify assignment exists and belongs to HOD branch
    const [assignment] = await db.select({
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (!assignment) {
      return apiError('Assignment not found', 404);
    }

    if (user.role !== 'admin' && user.branch && assignment.branch !== user.branch) {
      return apiError(`Forbidden. You can only authorize exceptions for ${user.branch} branch.`, 403);
    }

    // Check duplicate
    const existing = await db.query.makeupClassExceptions.findFirst({
      where: and(
        eq(makeupClassExceptions.assignment_id, assignment_id),
        eq(makeupClassExceptions.exception_date, exception_date),
        session_number ? eq(makeupClassExceptions.session_number, session_number) : isNull(makeupClassExceptions.session_number)
      )
    });

    if (existing) {
      return apiError('A makeup class exception already exists for this assignment and date.', 409);
    }

    const [result] = await db.insert(makeupClassExceptions).values({
      assignment_id,
      exception_date,
      session_number: session_number || null,
      reason,
      authorized_by_staff_id: user.id
    });

    return apiResponse({
      success: true,
      id: result.insertId,
      message: 'Makeup class exception authorized successfully'
    }, 201);
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error creating makeup exception:', err);
    return apiError('Internal Server Error', 500);
  }
}
