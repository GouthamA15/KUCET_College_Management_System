import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  branchTimetable, 
  semesters, 
  clerks, 
  syllabusSubjects 
} from '@/db/schema';
import { eq, and, desc, asc, sql, like, or, ne } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')) : 1;
    const section = searchParams.get('section') || 'A';

    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    const systemYear = semRows[0]?.academic_year || '2025-26';
    
    const timetable = await db.select({
      id: branchTimetable.id,
      branch: branchTimetable.branch,
      semester: branchTimetable.semester,
      section: branchTimetable.section,
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      subject_code: branchTimetable.subject_code,
      faculty_id: branchTimetable.faculty_id,
      academic_year: branchTimetable.academic_year,
      room_no: branchTimetable.room_no,
      faculty_name: clerks.name,
      subject_name: syllabusSubjects.subject_name
    })
    .from(branchTimetable)
    .leftJoin(clerks, eq(branchTimetable.faculty_id, clerks.id))
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(branchTimetable.branch, user.branch),
      eq(branchTimetable.semester, semester),
      eq(branchTimetable.section, section),
      or(
        like(branchTimetable.academic_year, `%${systemYear.substring(0, 4)}%`),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ))
    .orderBy(asc(branchTimetable.day_of_week), asc(branchTimetable.period_number));

    return apiResponse({ data: timetable });
  } catch (error) {
    logger.error('Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    let { 
      semester, section = 'A', day_of_week, period_number, 
      subject_code, faculty_id, academic_year = '2025-26', room_no = null 
    } = await req.json();

    const sanitizedFacultyId = (faculty_id === '' || !faculty_id) ? null : parseInt(faculty_id);

    if (sanitizedFacultyId) {
      const yearPrefix = academic_year.substring(0, 7);
      const isEvenSem = parseInt(semester) % 2 === 0;
      
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
        eq(branchTimetable.faculty_id, sanitizedFacultyId),
        eq(branchTimetable.day_of_week, day_of_week),
        eq(branchTimetable.period_number, period_number),
        or(
          like(branchTimetable.academic_year, `%${yearPrefix}%`),
          eq(branchTimetable.academic_year, academic_year)
        ),
        // Term Parity Check: Only conflict if both are Odd or both are Even
        sql`(${branchTimetable.semester} % 2 = 0) = ${isEvenSem}`,
        sql`NOT (${eq(branchTimetable.branch, user.branch)} AND ${eq(branchTimetable.semester, semester)} AND ${eq(branchTimetable.section, section)})`
      ))
      .limit(1);

      if (conflictRows.length > 0) {
        const c = conflictRows[0];
        return apiError(`Faculty Conflict: This instructor is already assigned to ${c.subject_name || c.subject_code} in ${c.branch} Sem ${c.semester} (Sec ${c.section}) during this period.`, 400);
      }
    }

    await db.insert(branchTimetable).values({
      branch: user.branch,
      semester: parseInt(semester),
      section: section,
      day_of_week: day_of_week,
      period_number: parseInt(period_number),
      subject_code: subject_code,
      faculty_id: sanitizedFacultyId,
      academic_year: academic_year,
      room_no: room_no
    })
    .onDuplicateKeyUpdate({
      set: {
        subject_code: sql`VALUES(subject_code)`,
        faculty_id: sql`VALUES(faculty_id)`,
        room_no: sql`VALUES(room_no)`
      }
    });

    // REAL-TIME
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: user.branch, semester });
    } catch (e) {}

    return apiResponse({ success: true, message: 'Slot updated successfully' });
  } catch (error) {
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
    } catch (e) {}

    return apiResponse({ success: true, message: 'Timetable data updated successfully' });
  } catch (error) {
    logger.error('Timetable Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
