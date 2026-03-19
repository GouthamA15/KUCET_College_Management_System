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

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
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
    const facultyLoad = await db.select({
      id: clerks.id,
      name: clerks.name,
      email: clerks.email,
      home_branch: clerks.branch,
      scheduled_weekly: sql`(
        SELECT COUNT(*) 
        FROM ${branchTimetable} bt 
        WHERE bt.faculty_id = ${clerks.id} 
        AND (bt.academic_year LIKE ${yearPattern} OR bt.academic_year = '2025-26')
      )`,
      total_conducted: sql`(
        SELECT COUNT(DISTINCT ads.id)
        FROM ${attendanceSessions} ads
        JOIN ${facultySubjectAssignments} fsa ON ads.assignment_id = fsa.id
        WHERE ads.faculty_id = ${clerks.id}
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = '2025-26')
      )`,
      subjects: sql`(
        SELECT GROUP_CONCAT(DISTINCT fsa.subject_name SEPARATOR ', ')
        FROM ${facultySubjectAssignments} fsa
        WHERE fsa.faculty_id = ${clerks.id} AND fsa.is_active = 1
        AND (fsa.academic_year LIKE ${yearPattern} OR fsa.academic_year = '2025-26')
      )`
    })
    .from(clerks)
    .where(and(
      eq(clerks.role, 'faculty'),
      eq(clerks.branch, user.branch),
      eq(clerks.is_active, true)
    ))
    .orderBy(desc(sql`scheduled_weekly`), asc(clerks.name));

    return apiResponse({ 
      data: facultyLoad.map(f => ({
        ...f,
        scheduled_weekly: Number(f.scheduled_weekly || 0),
        total_conducted: Number(f.total_conducted || 0)
      })),
      meta: { systemYear }
    });
  } catch (error) {
    console.error('Faculty Load API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
