import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  syllabusSubjects, 
  syllabusStructure, 
  academicPrograms,
  academicDepartments,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (request, { user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const semester = searchParams.get('semester');

      if (!user.hod_department_code) {
        return apiError('Unauthorized - Active HOD Assignment Required', 403);
      }

      // 1. Get all active programs for the HOD's department
      const programs = await db.select({ program_code: academicPrograms.program_code })
        .from(academicPrograms)
        .innerJoin(academicDepartments, eq(academicPrograms.department_id, academicDepartments.id))
        .where(eq(academicDepartments.department_code, user.hod_department_code));

      const validBranches = programs.map(p => p.program_code);
      // Include the department code itself as some subjects might just be mapped to 'CSE' instead of 'BTECH-CSE'
      validBranches.push(user.hod_department_code);

      const branchesList = [...new Set(validBranches)];

      let conditions = [inArray(syllabusStructure.branch, branchesList)];
      
      if (semester && semester !== 'ALL') {
        conditions.push(eq(syllabusStructure.semester, parseInt(semester, 10)));
      }

      // 2. Get available subjects from syllabus
      const subjects = await db.select({
        subject_code: syllabusStructure.subject_code,
        subject_name: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type,
        semester: syllabusStructure.semester,
        branch: syllabusStructure.branch
      })
      .from(syllabusStructure)
      .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
      .where(and(...conditions))
      .orderBy(syllabusStructure.semester, syllabusSubjects.subject_name);

      // Deduplicate subjects by subject_code, branch, and semester
      const uniqueSubjectsMap = new Map();
      subjects.forEach(s => {
        const key = `${s.subject_code}-${s.branch}-${s.semester}`;
        if (!uniqueSubjectsMap.has(key)) {
          uniqueSubjectsMap.set(key, s);
        }
      });
      const uniqueSubjects = Array.from(uniqueSubjectsMap.values());

      // Add academic_year implicitly
      const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
      const currentAcademicYear = await getCollegeAcademicYear(collegeRows[0] || null);

      const mappedSubjects = uniqueSubjects.map(s => ({
        ...s,
        academic_year: currentAcademicYear
      }));

      return apiResponse({ data: mappedSubjects });
    } catch (error) {
      logger.error('Available Subjects API Error:', error);
      return apiError('Internal Server Error', 500);
    }
  }
});
