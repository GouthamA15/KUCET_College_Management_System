import { db } from '@/db';
import { 
  semesters, 
  clerks, 
  branchTimetable, 
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
    const yearPattern = `%${academicYear.substring(0, 4)}%`;

    // Metrics definitions (moved from API route to service)
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
}
