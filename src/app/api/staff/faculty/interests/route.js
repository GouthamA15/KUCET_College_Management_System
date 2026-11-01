import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectInterests, 
  facultySubjectAssignments,
  syllabusStructure,
  academicDepartments, 
  academicPrograms, 
  collegeInfo as collegeInfoTable 
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

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

    if (!subject_code || !subject_name || !branch || !semester) {
      return apiError('Missing required fields: subject_code, subject_name, branch, and semester are required.', 400);
    }

    const normBranch = String(branch).toUpperCase().trim();
    const parsedSemester = parseInt(semester, 10);

    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      return apiError('Semester must be between 1 and 8', 400);
    }

    if (academic_year && !academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    // Resolve academic year if not provided
    let resolvedAcademicYear = academic_year;
    if (!resolvedAcademicYear) {
       const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
       const collegeInfo = collegeRows[0] || null;
       resolvedAcademicYear = await getCollegeAcademicYear(collegeInfo) || '2025-26';
    }

    // Validate subject exists in the specified branch and semester
    const subjectCheck = await db.select({ subject_code: syllabusStructure.subject_code })
      .from(syllabusStructure)
      .where(and(
        eq(syllabusStructure.subject_code, subject_code),
        eq(syllabusStructure.branch, normBranch),
        eq(syllabusStructure.semester, parsedSemester)
      ))
      .limit(1);

    if (subjectCheck.length === 0) {
      return apiError(`Subject ${subject_code} does not exist in ${normBranch} Semester ${parsedSemester} syllabus.`, 400);
    }

    // Resolve authoritative department_code for the branch
    let resolvedDeptCode = department_code ? String(department_code).toUpperCase().trim() : null;
    if (!resolvedDeptCode) {
      // Check if branch matches academicDepartments
      const deptMatch = await db.select({ code: academicDepartments.department_code })
        .from(academicDepartments)
        .where(eq(academicDepartments.department_code, normBranch))
        .limit(1);
      
      if (deptMatch.length > 0) {
        resolvedDeptCode = deptMatch[0].code;
      } else {
        // Check if branch matches academicPrograms and get parent department
        const progMatch = await db.select({ code: academicDepartments.department_code })
          .from(academicPrograms)
          .innerJoin(academicDepartments, eq(academicPrograms.department_id, academicDepartments.id))
          .where(eq(academicPrograms.program_code, normBranch))
          .limit(1);
        
        resolvedDeptCode = progMatch.length > 0 ? progMatch[0].code : normBranch;
      }
    }

    // 1. Check if already actively assigned
    const existingAssignment = await db.query.facultySubjectAssignments.findFirst({
      where: and(
        eq(facultySubjectAssignments.staff_account_id, user.id),
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, normBranch),
        eq(facultySubjectAssignments.course_semester, parsedSemester),
        eq(facultySubjectAssignments.academic_year, resolvedAcademicYear),
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
        eq(facultySubjectInterests.branch, normBranch),
        eq(facultySubjectInterests.semester, parsedSemester),
        eq(facultySubjectInterests.academic_year, resolvedAcademicYear)
      )
    });

    if (existingInterest) {
      return apiError(`You have already submitted a request for this subject (Status: ${existingInterest.status})`, 400);
    }

    await db.insert(facultySubjectInterests).values({
      staff_account_id: user.id,
      subject_code,
      subject_name,
      branch: normBranch,
      department_code: resolvedDeptCode,
      semester: parsedSemester,
      academic_year: resolvedAcademicYear,
      status: 'PENDING'
    });

    return apiResponse({ message: 'Interest submitted successfully' });
  } catch (error) {
    logger.error('Interest Submit Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

