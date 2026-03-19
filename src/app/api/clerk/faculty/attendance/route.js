import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  collegeInfo as collegeInfoTable 
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { isSemesterActive } from '@/lib/academic-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, date, session, attendance_data } = body;

    if (!assignment_id || !date || !session || !Array.isArray(attendance_data)) {
      return apiError('Missing required fields', 400);
    }

    // Validate each attendance record: status must not be null/undefined
    for (const item of attendance_data) {
      if (item == null || item.student_id == null) {
        return apiError('Missing attendance item or student_id', 400);
      }
      if (item.status === null || item.status === undefined) {
        return apiError('Status cannot be null', 400);
      }
    }

    // Verify assignment belongs to faculty
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
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
      if (attendance_data.length > 0) {
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
      }
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
    console.error('Attendance Update Error:', error);
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
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;
    const date = searchParams.get('date');
    const session = searchParams.get('session') ? parseInt(searchParams.get('session')) : null;

    if (!assignment_id || !date || !session) {
      return apiError('Missing required parameters', 400);
    }

    // Verify assignment and activity
    const assignments = await db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
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
    console.error('Attendance Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
