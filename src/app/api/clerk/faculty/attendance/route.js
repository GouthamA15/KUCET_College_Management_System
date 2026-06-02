import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  collegeInfo as collegeInfoTable,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { isSemesterActive } from '@/lib/academic-utils';
import { z } from 'zod';

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();

    // --- ZERO TRUST VALIDATION ---
    const attendanceSchema = z.object({
      assignment_id: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      session: z.number().int().min(1).max(8),
      attendance_data: z.array(z.object({
        student_id: z.number().int().positive(),
        status: z.enum(['PRESENT', 'ABSENT', 'ON_DUTY', 'SUSPENDED'])
      })).min(1, "Attendance data cannot be empty")
    });

    const validatedData = attendanceSchema.parse(json);
    const { assignment_id, date, session, attendance_data } = validatedData;

    // 1. Verify assignment existence and get details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.faculty_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Authorization logic (Primary Faculty, HOD, or Substitute)
    let isAuthorized = false;

    if (assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      // Check for active substitution on this date
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to mark attendance for this assignment', 403);
    }

    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Check if assignment is active
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    // Transaction
    await db.transaction(async (tx) => {
      const values = attendance_data.map(item => ({
        student_id: item.student_id,
        assignment_id: targetAssignmentId,
        date: date,
        session: session,
        status: item.status
      }));

      await tx.insert(studentAttendance)
        .values(values)
        .onDuplicateKeyUpdate({
          set: { status: sql`VALUES(status)` }
        });
    });

    // REAL-TIME: Notify HOD/Faculty
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('ATTENDANCE_SAVED', { 
        faculty_id: user.id, 
        branch: assignment.branch 
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({ message: 'Attendance updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors[0].message, 400);
    }
    logger.error('Attendance Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id_raw = searchParams.get('assignment_id');
    const date = searchParams.get('date');
    const session_raw = searchParams.get('session');

    // --- ZERO TRUST VALIDATION (Query Params) ---
    const deleteSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      session: z.preprocess(v => Number(v), z.number().int().min(1).max(8))
    });

    const validatedData = deleteSchema.parse({
      assignment_id: assignment_id_raw,
      date,
      session: session_raw
    });

    const { assignment_id, session } = validatedData;

    // 1. Verify assignment existence and get details
    const assignments = await db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.faculty_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Authorization logic (Primary Faculty, HOD, or Substitute)
    let isAuthorized = false;

    if (assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      // Check for active substitution on this date
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to delete attendance for this assignment', 403);
    }

    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    await db.delete(studentAttendance)
      .where(and(
        eq(studentAttendance.assignment_id, targetAssignmentId),
        eq(studentAttendance.date, date),
        eq(studentAttendance.session, session)
      ));

    return apiResponse({ message: 'Attendance for the selected date has been deleted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors[0].message, 400);
    }
    logger.error('Attendance Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
