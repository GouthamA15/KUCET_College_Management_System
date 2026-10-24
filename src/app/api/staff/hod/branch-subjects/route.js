import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { FacultyService } from '@/services/FacultyService';

export const dynamic = 'force-dynamic';

export async function GET(_req) {
  let user;
  try {
    user = await getAuthUser('hod');
    if (!user) {
      user = await getAuthUser('faculty');
      if (user && !user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
        user = null;
      }
    }
    if (!user || (!((user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    if (user.is_first_year_coordinator && !user.is_hod && user.role !== 'admin') {
      const { getInstitutionalBranches } = await import('@/lib/academic-authorization');
      const allBranches = await getInstitutionalBranches();

      const subjects = await db.select({
        subject_code: syllabusStructure.subject_code,
        subject_name: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type,
        semester: syllabusStructure.semester,
        branch: syllabusStructure.branch
      })
      .from(syllabusStructure)
      .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
      .where(and(
        inArray(syllabusStructure.branch, allBranches),
        inArray(syllabusStructure.semester, [1, 2])
      ))
      .orderBy(syllabusStructure.semester, syllabusSubjects.subject_name);

      return apiResponse({ data: subjects || [] });
    }

    const hodBranches = await FacultyService.getHodBranches(user.id);
    if (hodBranches.length === 0) {
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // Get all subjects associated with these branches across all semesters
    const subjects = await db.select({
      subject_code: syllabusStructure.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      semester: syllabusStructure.semester,
      branch: syllabusStructure.branch
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(inArray(syllabusStructure.branch, hodBranches))
    .orderBy(syllabusStructure.semester, syllabusSubjects.subject_name);

    return apiResponse({ data: subjects || [] });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'Branch Subjects API Error');
    return apiError('Internal Server Error', 500, error.message);
  }
}
