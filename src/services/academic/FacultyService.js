import { fetchWithSWR } from '@/lib/cache';
import { db } from '@/db';
import { 
  semesters, 
  clerks, 
  branchTimetable,
  studentMarks,
  syllabusSubjects,
  attendanceSessions,
  facultySubjectAssignments
} from '@/db/schema';
import { eq, and, desc, asc, sql, like, or } from 'drizzle-orm';

/**
 * Service for Faculty and HOD-related business logic
 */
export class FacultyService {
  /**
   * Fetch current academic year from system settings
   * @returns {Promise<string>} The current academic year
   */
  static async getCurrentAcademicYear() {
    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    return semRows[0]?.academic_year || '2025-26';
  }

  /**
   * Fetch detailed workload metrics for all faculty members in a branch
   * @param {string} academicYear The academic year to filter by
   * @returns {Promise<Array>} List of faculty with their workload metrics
   */
  static async getFacultyLoad(academicYear) {
    const yearPattern = `${academicYear.substring(0, 4)}%`;

    const [facultyList, scheduledRows, conductedRows, subjectsRows] = await Promise.all([
      db.select({
        id: clerks.id,
        name: clerks.name,
        email: clerks.email,
        home_branch: clerks.branch
      })
      .from(clerks)
      .where(eq(clerks.role, 'faculty')),

      db.select({
        faculty_id: branchTimetable.faculty_id,
        count: sql`COUNT(*)`.mapWith(Number)
      })
      .from(branchTimetable)
      .where(or(
        like(branchTimetable.academic_year, yearPattern),
        eq(branchTimetable.academic_year, academicYear)
      ))
      .groupBy(branchTimetable.faculty_id),

      db.select({
        faculty_id: attendanceSessions.faculty_id,
        count: sql`COUNT(DISTINCT ${attendanceSessions.id})`.mapWith(Number)
      })
      .from(attendanceSessions)
      .innerJoin(facultySubjectAssignments, eq(attendanceSessions.assignment_id, facultySubjectAssignments.id))
      .where(or(
        like(facultySubjectAssignments.academic_year, yearPattern),
        eq(facultySubjectAssignments.academic_year, academicYear)
      ))
      .groupBy(attendanceSessions.faculty_id),

      db.select({
        faculty_id: facultySubjectAssignments.faculty_id,
        subjects: sql`GROUP_CONCAT(DISTINCT ${facultySubjectAssignments.subject_name} SEPARATOR ', ')`
      })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.is_active, true),
        or(
          like(facultySubjectAssignments.academic_year, yearPattern),
          eq(facultySubjectAssignments.academic_year, academicYear)
        )
      ))
      .groupBy(facultySubjectAssignments.faculty_id)
    ]);

    const scheduledMap = new Map(scheduledRows.map(r => [r.faculty_id, r.count]));
    const conductedMap = new Map(conductedRows.map(r => [r.faculty_id, r.count]));
    const subjectsMap = new Map(subjectsRows.map(r => [r.faculty_id, r.subjects || '']));

    return facultyList.map(f => ({
      id: f.id,
      name: f.name,
      email: f.email,
      home_branch: f.home_branch,
      scheduled_weekly: scheduledMap.get(f.id) || 0,
      total_conducted: conductedMap.get(f.id) || 0,
      subjects: subjectsMap.get(f.id) || ''
    })).sort((a, b) => {
      if (b.scheduled_weekly !== a.scheduled_weekly) {
        return b.scheduled_weekly - a.scheduled_weekly;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  /**
   * Atomic update for student marks with optimistic locking
   */
  static async updateMarkAtomic(id, data, originalVersion, tx = db) {
    const res = await tx.update(studentMarks)
      .set({ 
        ...data, 
        version: sql`version + 1` 
      })
      .where(and(
        eq(studentMarks.id, id),
        eq(studentMarks.version, originalVersion)
      ));
    
    // For MySQL2, Drizzle returns a ResultSetHeader in an array or as the first element
    const header = Array.isArray(res) ? res[0] : res;
    return (header?.affectedRows || 0) > 0;
  }

  /**
   * Atomic update for timetable slot with optimistic locking
   */
  static async updateTimetableAtomic(id, data, originalVersion, tx = db) {
    const res = await tx.update(branchTimetable)
      .set({ 
        ...data, 
        version: sql`version + 1` 
      })
      .where(and(
        eq(branchTimetable.id, id),
        eq(branchTimetable.version, originalVersion)
      ));
    
    const header = Array.isArray(res) ? res[0] : res;
    return (header?.affectedRows || 0) > 0;
  }

  /**
   * Fetch consistent branch timetable for any role (HOD or Student)
   */
  static async getBranchTimetable({ branch, semester, section, academicYear }) {
    let systemYear = academicYear;
    if (!systemYear) {
      systemYear = await this.getCurrentAcademicYear();
    }

    const whereClause = [
      eq(branchTimetable.branch, branch),
      eq(branchTimetable.semester, semester),
      or(
        like(branchTimetable.academic_year, `${systemYear.substring(0, 4)}%`),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ];

    if (section) {
      whereClause.push(eq(branchTimetable.section, section));
    }

    const cacheKey = `timetable:${branch}:${semester}:${systemYear}:${section || 'all'}`;
    return await fetchWithSWR(cacheKey, async () => {
      return await db.select({
        id: branchTimetable.id,
        day_of_week: branchTimetable.day_of_week,
        period_number: branchTimetable.period_number,
        subject_code: branchTimetable.subject_code,
        faculty_id: branchTimetable.faculty_id,
        academic_year: branchTimetable.academic_year,
        room_no: branchTimetable.room_no,
        version: branchTimetable.version,
        faculty_name: sql`COALESCE(CASE WHEN ${clerks.is_active} = false THEN CONCAT('[Unassigned - Formerly ', ${clerks.name}, ']') ELSE ${clerks.name} END, '[Unassigned]')`,
        subject_name: syllabusSubjects.subject_name,
        display_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`
      })
      .from(branchTimetable)
      .leftJoin(clerks, eq(branchTimetable.faculty_id, clerks.id))
      .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
      .where(and(...whereClause))
      .orderBy(
        asc(sql`FIELD(${branchTimetable.day_of_week}, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')`),
        asc(branchTimetable.period_number)
      );
    }, 60, 3600);
  }
}
