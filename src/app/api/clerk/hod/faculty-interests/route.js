import logger from '@/lib/logger';
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

export async function GET(_request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized - HOD Access Required', 401);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    const allocatedSubquery = db.select({
      names: sql`GROUP_CONCAT(${clerks.name} SEPARATOR ', ')`.as('names'),
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .innerJoin(clerks, eq(facultySubjectAssignments.faculty_id, clerks.id))
    .groupBy(
      facultySubjectAssignments.subject_code,
      facultySubjectAssignments.branch,
      facultySubjectAssignments.course_semester,
      facultySubjectAssignments.academic_year
    )
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
      allocated_faculty_name: allocatedSubquery.names
    })
    .from(facultySubjectInterests)
    .innerJoin(clerks, eq(facultySubjectInterests.faculty_id, clerks.id))
    .leftJoin(allocatedSubquery, and(
      eq(facultySubjectInterests.subject_code, allocatedSubquery.subject_code),
      eq(facultySubjectInterests.branch, allocatedSubquery.branch),
      eq(facultySubjectInterests.semester, allocatedSubquery.course_semester),
      eq(facultySubjectInterests.academic_year, allocatedSubquery.academic_year)
    ))
    .where(and(
      eq(facultySubjectInterests.branch, user.branch), // HOD can only see their branch
      or(
        eq(facultySubjectInterests.academic_year, currentAcademicYear),
        eq(facultySubjectInterests.status, 'PENDING')
      )
    ))
    .orderBy(desc(sql`${facultySubjectInterests.status} = 'PENDING'`), desc(facultySubjectInterests.created_at));

    return apiResponse({ data: interests });
  } catch (error) {
    logger.error('HOD Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized - HOD Access Required', 401);
    }

    const body = await request.json();
    const { interest_id, status } = body;

    if (!interest_id || !status) return apiError('Missing required fields', 400);
    if (!['APPROVED', 'REJECTED'].includes(status)) return apiError('Invalid status', 400);

    await db.transaction(async (tx) => {
      const interest = await tx.query.facultySubjectInterests.findFirst({
        where: eq(facultySubjectInterests.id, interest_id)
      });

      if (!interest) {
        throw new Error('NOT_FOUND');
      }

      if (interest.branch !== user.branch) {
        throw new Error('NOT_AUTHORIZED');
      }

      await tx.update(facultySubjectInterests)
        .set({ status })
        .where(eq(facultySubjectInterests.id, interest_id));

      if (status === 'APPROVED') {
        const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
        
        // Prevent duplicate insertions since there is no unique constraint
        const existing = await tx.query.facultySubjectAssignments.findFirst({
          where: and(
            eq(facultySubjectAssignments.faculty_id, interest.faculty_id),
            eq(facultySubjectAssignments.subject_code, interest.subject_code),
            eq(facultySubjectAssignments.branch, interest.branch),
            eq(facultySubjectAssignments.course_semester, interest.semester),
            eq(facultySubjectAssignments.academic_year, interest.academic_year),
            eq(facultySubjectAssignments.is_active, true)
          )
        });

        if (!existing) {
          await tx.insert(facultySubjectAssignments).values({
            faculty_id: interest.faculty_id,
            subject_code: interest.subject_code,
            subject_name: interest.subject_name,
            branch: interest.branch,
            course_semester: interest.semester,
            academic_term: academicTerm,
            academic_year: interest.academic_year,
            is_active: true
          });
        }
      }
    });

    return apiResponse({ message: `Interest ${status.toLowerCase()} successfully` });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return apiError('Interest not found', 404);
    if (error.message === 'NOT_AUTHORIZED') return apiError('Not authorized for this branch', 403);
    logger.error('HOD Approve Interest Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
