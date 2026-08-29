import logger from '@/lib/logger';
import { db } from '@/db';
import { facultySubjectInterests } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(_request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const interests = await db.query.facultySubjectInterests.findMany({
      where: eq(facultySubjectInterests.staff_account_id, user.id),
      orderBy: [desc(facultySubjectInterests.created_at)]
    });

    return apiResponse({ data: interests });
  } catch (error) {
    logger.error('Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const body = await request.json();
    const { subject_code, subject_name, branch, department_code, semester, academic_year } = body;

    if (!subject_code || !subject_name || !branch || !department_code || !semester || !academic_year) {
      return apiError('Missing required fields, including department_code', 400);
    }

    if (!academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const { staffAcademicAffiliations, academicDepartments, academicPrograms } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');

    const affil = await db.select({ 
      dept_id: academicDepartments.id,
      dept_code: academicDepartments.department_code, 
      prog_code: academicPrograms.program_code 
    })
    .from(staffAcademicAffiliations)
    .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
    .where(eq(staffAcademicAffiliations.staff_account_id, user.id));

    if (affil.length === 0) {
      return apiError('No academic affiliations found for this staff member', 403);
    }

    const deptIds = Array.from(new Set(affil.map(a => a.dept_id)));
    const allPrograms = await db.select({ prog_code: academicPrograms.program_code })
      .from(academicPrograms)
      .where(inArray(academicPrograms.department_id, deptIds));

    const allProgramCodes = allPrograms.map(p => p.prog_code);
    const rawDepts = affil.map(a => a.dept_code);
    const allowedBranches = Array.from(new Set([...allProgramCodes, ...rawDepts].filter(Boolean)));

    if (!allowedBranches.includes(branch)) {
      return apiError(`Unauthorized: You can only request subjects for your affiliated departments/programs.`, 403);
    }

    const { facultySubjectAssignments } = await import('@/db/schema');
    
    // 1. Check if already actively assigned
    const existingAssignment = await db.query.facultySubjectAssignments.findFirst({
      where: and(
        eq(facultySubjectAssignments.staff_account_id, user.id),
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, semester),
        eq(facultySubjectAssignments.academic_year, academic_year),
        eq(facultySubjectAssignments.is_active, true)
      )
    });

    if (existingAssignment) {
      return apiError('You are already assigned to teach this subject', 400);
    }

    // 2. Check if a request already exists for this exact subject in this academic year
    const existingInterest = await db.query.facultySubjectInterests.findFirst({
      where: and(
        eq(facultySubjectInterests.staff_account_id, user.id),
        eq(facultySubjectInterests.subject_code, subject_code),
        eq(facultySubjectInterests.branch, branch),
        eq(facultySubjectInterests.semester, semester),
        eq(facultySubjectInterests.academic_year, academic_year)
      )
    });

    if (existingInterest) {
      return apiError(`You have already submitted a request for this subject (Status: ${existingInterest.status})`, 400);
    }

    await db.insert(facultySubjectInterests).values({
      staff_account_id: user.id,
      subject_code,
      subject_name,
      branch,
      department_code,
      semester: parseInt(semester),
      academic_year,
      status: 'PENDING'
    });

    return apiResponse({ message: 'Interest submitted successfully' });
  } catch (error) {
    logger.error('Interest Submit Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
