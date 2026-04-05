import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  semesters, 
  clerks, 
  branchTimetable, 
  attendanceSessions, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and, desc, asc, sql, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  let user;
  try {
    user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      logger.warn(`HOD ${user.email} accessed faculty-load without an assigned branch.`);
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // 1. Resolve current academic year
    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    const systemYear = semRows[0]?.academic_year || '2025-26';
    const yearPattern = `%${systemYear.substring(0, 4)}%`;

    // 2. Fetch Detailed Workload
    // Metrics: Scheduled (Timetable), Conducted (Sessions Marked), and Assignments
    const scheduledWeeklyExpr = sql`(
        SELECT COUNT(*) 
        FROM branch_timetable 
        WHERE branch_timetable.faculty_id = clerks.id 
        AND (branch_timetable.academic_year LIKE ${yearPattern} OR branch_timetable.academic_year = '2025-26')
      )`.mapWith(Number);

    const totalConductedExpr = sql`(
        SELECT COUNT(DISTINCT ads.id)
        FROM attendance_sessions ads
        JOIN faculty_subject_assignments fsa ON ads.assignment_id = fsa.id
        WHERE ads.faculty_id = clerks.id
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = '2025-26')
      )`.mapWith(Number);

    const subjectsExpr = sql`(
        SELECT GROUP_CONCAT(DISTINCT fsa.subject_name SEPARATOR ', ')
        FROM faculty_subject_assignments fsa
        WHERE fsa.faculty_id = clerks.id AND fsa.is_active = 1
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = '2025-26')
      )`;

    const facultyLoad = await db.select({
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

    return apiResponse({ 
      data: facultyLoad,
      meta: { systemYear }
    });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'Faculty Load API Error');
    console.error('[DEBUG] Faculty Load Error:', error.message);
    return apiError('Internal Server Error', 500, error.message);
  }
}
