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
  auth: ['hod', 'faculty'],
  handler: async (request, { user }) => {
    try {
      const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
      if (!isAuthorized) {
        return apiError('Unauthorized', 403);
      }

      const { searchParams } = new URL(request.url);
      const semester = searchParams.get('semester');

      let branchesList = [];

      if (user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        const { getInstitutionalBranches } = await import('@/lib/academic-authorization');
        branchesList = await getInstitutionalBranches();

        if (semester && semester !== 'ALL') {
          const semInt = parseInt(semester, 10);
          if (semInt !== 1 && semInt !== 2) {
            return apiError('Forbidden: First Year Coordinator access is restricted to semesters 1 and 2', 403);
          }
        }
      } else {
        if (!user.hod_department_code && user.role !== 'admin') {
          return apiError('Unauthorized - Active HOD Assignment Required', 403);
        }

        const { staffAcademicAffiliations } = await import('@/db/schema');
        const affil = await db.select({ 
          prog_code: academicPrograms.program_code,
          dept_code: academicDepartments.department_code
        })
        .from(staffAcademicAffiliations)
        .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
        .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
        .where(eq(staffAcademicAffiliations.staff_account_id, user.id));

        const validBranches = affil.map(a => a.prog_code).filter(Boolean);
        validBranches.push(...affil.map(a => a.dept_code).filter(Boolean));
        if (user.hod_department_code) validBranches.push(user.hod_department_code);
        branchesList = [...new Set(validBranches)];
      }

      let conditions = [inArray(syllabusStructure.branch, branchesList)];
      
      if (semester && semester !== 'ALL') {
        conditions.push(eq(syllabusStructure.semester, parseInt(semester, 10)));
      } else if (user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        conditions.push(inArray(syllabusStructure.semester, [1, 2]));
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
