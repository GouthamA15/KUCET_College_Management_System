import { db } from '@/db';
import { 
  semesters, 
  clerks, 
  branchTimetable,
  studentMarks,
  syllabusSubjects
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
    const yearPattern = `%${academicYear.substring(0, 4)}%`;

    const scheduledWeeklyExpr = sql`(
        SELECT COUNT(*) 
        FROM branch_timetable 
        WHERE branch_timetable.faculty_id = clerks.id 
        AND (branch_timetable.academic_year LIKE ${yearPattern} OR branch_timetable.academic_year = ${academicYear})
      )`.mapWith(Number);

    const totalConductedExpr = sql`(
        SELECT COUNT(DISTINCT ads.id)
        FROM attendance_sessions ads
        JOIN faculty_subject_assignments fsa ON ads.assignment_id = fsa.id
        WHERE ads.faculty_id = clerks.id
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = ${academicYear})
      )`.mapWith(Number);

    const subjectsExpr = sql`(
        SELECT GROUP_CONCAT(DISTINCT fsa.subject_name SEPARATOR ', ')
        FROM faculty_subject_assignments fsa
        WHERE fsa.faculty_id = clerks.id AND fsa.is_active = 1
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = ${academicYear})
      )`;

    return await db.select({
      id: clerks.id,
      name: clerks.name,
      email: clerks.email,
      home_branch: clerks.branch,
      scheduled_weekly: scheduledWeeklyExpr,
      total_conducted: totalConductedExpr,
      subjects: subjectsExpr
    })
    .from(clerks)
    .where(eq(clerks.role, 'faculty'))
    .orderBy(desc(scheduledWeeklyExpr), asc(clerks.name));
  }

  /**
   * Atomic update for student marks with optimistic locking
   */
  static async updateMarkAtomic(id, data, originalVersion, tx = db) {
    const result = await tx.update(studentMarks)
      .set({ 
        ...data, 
        version: sql`version + 1` 
      })
      .where(and(
        eq(studentMarks.id, id),
        eq(studentMarks.version, originalVersion)
      ));
    
    return result.affectedRows > 0;
  }

  /**
   * Atomic update for timetable slot with optimistic locking
   */
  static async updateTimetableAtomic(id, data, originalVersion) {
    const result = await db.update(branchTimetable)
      .set({ 
        ...data, 
        version: sql`version + 1` 
      })
      .where(and(
        eq(branchTimetable.id, id),
        eq(branchTimetable.version, originalVersion)
      ));
    
    return result.affectedRows > 0;
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
        like(branchTimetable.academic_year, `%${systemYear.substring(0, 4)}%`),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ];

    if (section) {
      whereClause.push(eq(branchTimetable.section, section));
    }

    return await db.select({
      id: branchTimetable.id,
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      subject_code: branchTimetable.subject_code,
      faculty_id: branchTimetable.faculty_id,
      academic_year: branchTimetable.academic_year,
      room_no: branchTimetable.room_no,
      version: branchTimetable.version,
      faculty_name: clerks.name,
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
  }
}
