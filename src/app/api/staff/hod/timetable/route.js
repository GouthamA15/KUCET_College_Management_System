import { apiError, apiResponse, getAuthUser, wrapHandler } from '@/lib/api-utils';
import { FacultyService } from '@/services/FacultyService';
import { timetableSlotSchema } from '@/lib/validations/staff';
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
  auth: 'clerk',
  handler: async (req, { user }) => {
    if (user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized: HOD only', 403);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')) : 1;
    const section = searchParams.get('section') || 'A';

    const systemYear = await FacultyService.getCurrentAcademicYear();
    const timetable = await FacultyService.getBranchTimetable({
      branch: user.branch,
      semester,
      section,
      academicYear: systemYear
    });

    return { data: timetable };
  }
});

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const json = await req.json();

    // Validate with Zod
    const validationSchema = timetableSlotSchema.extend({
      id: z.number().int().positive().optional(),
      version: z.number().int().min(0).optional(),
      section: z.string().trim().max(1).toUpperCase().default('A'),
      academic_year: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-YY").default('2025-26'),
      semester: z.number().int().min(1).max(8),
      faculty_id: z.preprocess(
        (v) => (v === '' || v === undefined || v === null) ? null : Number(v),
        z.number().int().positive().nullable()
      )
    });

    const validatedData = validationSchema.parse(json);
    const { 
      id, version, semester, section, day_of_week, period_number, 
      subject_code, faculty_id, academic_year, room_no 
    } = validatedData;

    if (faculty_id) {
      const yearPrefix = academic_year.substring(0, 7);
      const isEvenSem = semester % 2 === 0;
      
      const conflictRows = await db.select({
        branch: branchTimetable.branch,
        semester: branchTimetable.semester,
        section: branchTimetable.section,
        subject_code: branchTimetable.subject_code,
        subject_name: syllabusSubjects.subject_name
      })
      .from(branchTimetable)
      .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
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
        id ? ne(branchTimetable.id, id) : sql`NOT (${eq(branchTimetable.branch, user.branch)} AND ${eq(branchTimetable.semester, semester)} AND ${eq(branchTimetable.section, section)})`
      ))
      .limit(1);

      if (conflictRows.length > 0) {
        const c = conflictRows[0];
        return apiError(`Faculty Conflict: This instructor is already assigned to ${c.subject_name || c.subject_code} in ${c.branch} Sem ${c.semester} (Sec ${c.section}) during this period.`, 400);
      }
    }

    const slotData = {
      branch: user.branch,
      semester: semester,
      section: section,
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
      broadcastUpdate('TIMETABLE_CHANGED', { branch: user.branch, semester });
    } catch (_e) { /* empty */ }

    return apiResponse({ success: true, message: 'Slot updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Timetable Save Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action'); // 'clearSemester' or 'clearAll'
    const semester = searchParams.get('semester');
    const section = searchParams.get('section') || 'A';
    const day_of_week = searchParams.get('day_of_week');
    const period_number = searchParams.get('period_number');

    if (action === 'clearSemester') {
      if (!semester) return apiError('Missing semester', 400);
      await db.delete(branchTimetable)
        .where(and(
          eq(branchTimetable.branch, user.branch),
          eq(branchTimetable.semester, parseInt(semester)),
          eq(branchTimetable.section, section)
        ));
    } 
    else if (action === 'clearAll') {
      await db.delete(branchTimetable)
        .where(eq(branchTimetable.branch, user.branch));
    }
    else {
      // Single slot deletion
      if (!semester || !day_of_week || !period_number) {
        return apiError('Missing required parameters', 400);
      }

      await db.delete(branchTimetable)
        .where(and(
          eq(branchTimetable.branch, user.branch),
          eq(branchTimetable.semester, parseInt(semester)),
          eq(branchTimetable.section, section),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, parseInt(period_number))
        ));
    }

    // REAL-TIME
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: user.branch, semester: semester ? parseInt(semester) : 'ALL' });
    } catch (_e) { /* empty */ }

    return apiResponse({ success: true, message: 'Timetable data updated successfully' });
  } catch (error) {
    logger.error('Timetable Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
