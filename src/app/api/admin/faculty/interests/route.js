import { db } from '@/db';
import { 
  facultySubjectInterests, 
  clerks, 
  collegeInfo as collegeInfoTable, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    const allocatedSubquery = db.select({
      name: clerks.name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .innerJoin(clerks, eq(facultySubjectAssignments.faculty_id, clerks.id))
    .as('asgn');

    const interests = await db.select({
      id: facultySubjectInterests.id,
      faculty_id: facultySubjectInterests.faculty_id,
      subject_code: facultySubjectInterests.subject_code,
      subject_name: facultySubjectInterests.subject_name,
      branch: facultySubjectInterests.branch,
      semester: facultySubjectInterests.semester,
      academic_year: facultySubjectInterests.academic_year,
      status: facultySubjectInterests.status,
      created_at: facultySubjectInterests.created_at,
      updated_at: facultySubjectInterests.updated_at,
      faculty_name: clerks.name,
      employee_id: clerks.employee_id,
      allocated_faculty_name: allocatedSubquery.name
    })
    .from(facultySubjectInterests)
    .innerJoin(clerks, eq(facultySubjectInterests.faculty_id, clerks.id))
    .leftJoin(allocatedSubquery, and(
      eq(facultySubjectInterests.subject_code, allocatedSubquery.subject_code),
      eq(facultySubjectInterests.branch, allocatedSubquery.branch),
      eq(facultySubjectInterests.semester, allocatedSubquery.course_semester),
      eq(facultySubjectInterests.academic_year, allocatedSubquery.academic_year)
    ))
    .where(or(
      eq(facultySubjectInterests.academic_year, currentAcademicYear),
      eq(facultySubjectInterests.status, 'PENDING')
    ))
    .orderBy(desc(sql`${facultySubjectInterests.status} = 'PENDING'`), desc(facultySubjectInterests.created_at));

    return apiResponse({ data: interests });
  } catch (error) {
    console.error('Admin Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
