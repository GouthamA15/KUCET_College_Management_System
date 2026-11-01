import { apiError, apiResponse, getAuthUser, wrapHandler } from '@/lib/api-utils';
import { FacultyService } from '@/services/FacultyService';
import { timetableSlotSchema } from '@/lib/validations/staff';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';
import { deriveDefaultAcademicYear } from '@/lib/academic-constants';
import { z } from 'zod';
import { db } from '@/db';
import { branchTimetable, syllabusSubjects } from '@/db/schema';
import { eq, and, like, or, ne, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * GET /api/staff/hod/timetable
 * Fetch branch timetable for HOD management
 */
export const GET = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) {
      return apiError('Unauthorized', 403);
    }

    const { searchParams } = new URL(req.url);
    const requestedBranch = searchParams.get('branch');
    const targetBranch = requestedBranch || user.branch || user.hod_department_code;

    const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')) : 1;

    if (!isAcademicScopeAllowed(user, { branch: targetBranch, semester })) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} Sem ${semester}`, 403);
    }

    const systemYear = await FacultyService.getCurrentAcademicYear();
    const timetable = await FacultyService.getBranchTimetable({
      branch: targetBranch,
      semester,
      academicYear: systemYear
    });

    return { data: timetable };
  }
});

export async function POST(req) {
  try {
    let user = await getAuthUser('hod');
    if (!user) {
      user = await getAuthUser('faculty');
      if (user && !user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        user = null;
      }
    }
    if (!user || (!((user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const json = await req.json();

    // Validate with Zod
    const validationSchema = timetableSlotSchema.extend({
      id: z.number().int().positive().optional(),
      version: z.number().int().min(0).optional(),
      branch: z.string().optional(),
      academic_year: z.string().regex(/^(\d{4}-\d{2}|\d{4}-\d{4})$/, "Format: YYYY-YY or YYYY-YYYY").default(deriveDefaultAcademicYear()),
      semester: z.number().int().min(1).max(8),
      faculty_id: z.preprocess(
        (v) => (v === '' || v === undefined || v === null) ? null : Number(v),
        z.number().int().positive().nullable()
      )
    });

    const validatedData = validationSchema.parse(json);
    const { 
      id, version, semester, day_of_week, 
      period_number, subject_code, faculty_id, academic_year, room_no 
    } = validatedData;

    const targetBranch = validatedData.branch || req.nextUrl?.searchParams?.get('branch') || user.branch || user.hod_department_code;

    if (!isAcademicScopeAllowed(user, { branch: targetBranch, semester })) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} Sem ${semester}`, 403);
    }

    // If updating an existing slot, verify the existing persisted record is also within scope
    if (id) {
      const [existingSlot] = await db.select().from(branchTimetable).where(eq(branchTimetable.id, id));
      if (!existingSlot) return apiError('Timetable slot not found', 404);
      if (!isAcademicScopeAllowed(user, { branch: existingSlot.branch, semester: existingSlot.semester })) {
        return apiError('Forbidden - Existing slot is outside your authorized scope', 403);
      }
    }

    // Verify subject exists in this branch/semester
    const subjectExists = await db.query.syllabusSubjects.findFirst({
      where: and(
        eq(syllabusSubjects.branch, targetBranch),
        eq(syllabusSubjects.semester, semester),
        eq(syllabusSubjects.subject_code, subject_code)
      )
    });

    if (!subjectExists) {
      return apiError(`Subject ${subject_code} is not registered for ${targetBranch} Sem ${semester}`, 400);
    }

    // FACULTY CONFLICT CHECK ACROSS BRANCHES
    if (faculty_id) {
      const isEvenSem = semester % 2 === 0;
      const yearPrefix = academic_year.substring(0, 4);

      const conflictRows = await db.select({
        id: branchTimetable.id,
        branch: branchTimetable.branch,
        semester: branchTimetable.semester,
        subject_code: branchTimetable.subject_code,
        subject_name: syllabusSubjects.subject_name
      })
      .from(branchTimetable)
      .leftJoin(syllabusSubjects, and(
        eq(branchTimetable.subject_code, syllabusSubjects.subject_code),
        eq(branchTimetable.branch, branchTimetable.branch)
      ))
      .where(and(
        eq(branchTimetable.faculty_id, faculty_id),
        eq(branchTimetable.day_of_week, day_of_week),
        eq(branchTimetable.period_number, period_number),
        or(
          like(branchTimetable.academic_year, `%${yearPrefix}%`),
          eq(branchTimetable.academic_year, academic_year)
        ),
        // Term Parity Check: Only conflict if both are Odd or both are Even
        sql`(${branchTimetable.semester} % 2 = 0) = ${isEvenSem}`,
        // Don't conflict with itself
        id ? ne(branchTimetable.id, id) : sql`NOT (${eq(branchTimetable.branch, targetBranch)} AND ${eq(branchTimetable.semester, semester)})`
      ))
      .limit(1);

      if (conflictRows.length > 0) {
        const c = conflictRows[0];
        return apiError(`Faculty Conflict: This instructor is already assigned to ${c.subject_name || c.subject_code} in ${c.branch} Sem ${c.semester} during this period.`, 400);
      }
    }

    const slotData = {
      branch: targetBranch,
      semester: semester,
      day_of_week: day_of_week,
      period_number: period_number,
      subject_code: subject_code,
      faculty_id: faculty_id,
      academic_year: academic_year,
      room_no: room_no
    };

    if (id) {
      // Optimistic Locking Update
      const success = await FacultyService.updateTimetableAtomic(id, slotData, version || 0);
      if (!success) {
        return apiError('Concurrency Conflict: This timetable slot was modified by another user. Please refresh.', 409);
      }
    } else {
      // New Slot or Coordinate-based upsert if ID is missing but slot exists
      await db.insert(branchTimetable).values(slotData)
      .onDuplicateKeyUpdate({
        set: {
          subject_code: sql`VALUES(subject_code)`,
          faculty_id: sql`VALUES(faculty_id)`,
          room_no: sql`VALUES(room_no)`,
          version: sql`version + 1`
        }
      });
    }

    // REAL-TIME
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: targetBranch, semester });
    } catch (_e) { /* empty */ }

    return apiResponse({ success: true, message: 'Slot updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Timetable Slot Save Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req) {
  try {
    let user = await getAuthUser('hod');
    if (!user) {
      user = await getAuthUser('faculty');
      if (user && !user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        user = null;
      }
    }
    if (!user || (!((user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const requestedBranch = searchParams.get('branch');
    const targetBranch = requestedBranch || user.branch || user.hod_department_code;

    const action = searchParams.get('action'); // 'clearSemester' or 'clearAll'
    const semester = searchParams.get('semester');
    const day_of_week = searchParams.get('day_of_week');
    const period_number = searchParams.get('period_number');

    if (action === 'clearAll') {
      if (user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        return apiError('Forbidden: First Year Coordinator cannot clear all department semesters', 403);
      }
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(targetBranch)) {
        return apiError(`Forbidden - Not authorized for ${targetBranch} branch.`, 403);
      }
      await db.delete(branchTimetable)
        .where(eq(branchTimetable.branch, targetBranch));
    }
    else if (action === 'clearSemester') {
      if (!semester) return apiError('Missing semester', 400);
      if (!isAcademicScopeAllowed(user, { branch: targetBranch, semester })) {
        return apiError(`Forbidden - Not authorized for ${targetBranch} Sem ${semester}`, 403);
      }
      await db.delete(branchTimetable)
        .where(and(
          eq(branchTimetable.branch, targetBranch),
          eq(branchTimetable.semester, parseInt(semester))
        ));
    } 
    else {
      // Single slot deletion
      if (!semester || !day_of_week || !period_number) {
        return apiError('Missing required parameters', 400);
      }
      if (!isAcademicScopeAllowed(user, { branch: targetBranch, semester })) {
        return apiError(`Forbidden - Not authorized for ${targetBranch} Sem ${semester}`, 403);
      }

      await db.delete(branchTimetable)
        .where(and(
          eq(branchTimetable.branch, targetBranch),
          eq(branchTimetable.semester, parseInt(semester)),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, parseInt(period_number))
        ));
    }

    // REAL-TIME
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: targetBranch, semester: semester ? parseInt(semester) : 'ALL' });
    } catch (_e) { /* empty */ }

    return apiResponse({ success: true, message: 'Timetable data updated successfully' });
  } catch (error) {
    logger.error('Timetable Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
