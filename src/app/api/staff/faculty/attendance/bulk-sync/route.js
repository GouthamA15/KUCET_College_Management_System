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

const itemSchema = z.object({
  id: z.string().optional(),
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.number().int().min(1).max(8),
  attendance_data: z.array(z.object({
    student_id: z.number().int().positive(),
    status: z.enum(['PRESENT', 'ABSENT', 'NCC', 'MEDICAL'])
  })).min(1, "Attendance data cannot be empty")
});

const bulkSchema = z.object({
  records: z.array(itemSchema).min(1, "Records array cannot be empty")
});

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();
    const validated = bulkSchema.parse(json);
    const { records } = validated;

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    const syncedIds = [];
    const errors = [];

    await db.transaction(async (tx) => {
      for (const record of records) {
        const { assignment_id, date, session, attendance_data, id: offlineId } = record;

        // 1. Verify assignment existence
        const assignments = await tx.select({
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
          errors.push({ id: offlineId, error: `Assignment #${assignment_id} not found` });
          continue;
        }

        const assignment = assignments[0];

        // 2. Authorization
        let isAuthorized = false;
        if (assignment.faculty_id === user.id) {
          isAuthorized = true;
        } else if (user.is_hod && user.branch === assignment.branch) {
          isAuthorized = true;
        } else {
          const sub = await tx.select()
            .from(facultySubstitutions)
            .where(and(
              eq(facultySubstitutions.original_assignment_id, assignment_id),
              eq(facultySubstitutions.substitute_faculty_id, user.id),
              eq(facultySubstitutions.substitution_date, date)
            ))
            .limit(1);
          if (sub.length > 0) isAuthorized = true;
        }

        if (!isAuthorized) {
          errors.push({ id: offlineId, error: `Unauthorized for assignment #${assignment_id}` });
          continue;
        }

        // 3. Semester Lock check
        const { subject_code, branch, course_semester, academic_year } = assignment;
        if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
          errors.push({ id: offlineId, error: `Semester ended for assignment #${assignment_id}` });
          continue;
        }

        // Canonical ID
        const canonicalRows = await tx.select({ id: facultySubjectAssignments.id })
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

        if (offlineId) syncedIds.push(offlineId);
      }
    });

    return apiResponse({
      message: `Bulk offline attendance processed successfully. Synced: ${syncedIds.length}`,
      synced_count: syncedIds.length,
      synced_ids: syncedIds,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error(error, '[BULK_ATTENDANCE_SYNC_ERROR]');
    return apiError('Internal Server Error', 500);
  }
}
