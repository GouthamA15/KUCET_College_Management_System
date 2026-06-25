import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(_req) {
  let user;
  try {
    user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      logger.warn(`HOD ${user.email} accessed branch-subjects without an assigned branch.`);
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // Get all subjects associated with this branch across all semesters
    const subjects = await db.select({
      subject_code: syllabusStructure.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      semester: syllabusStructure.semester
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(eq(syllabusStructure.branch, user.branch))
    .orderBy(syllabusStructure.semester, syllabusSubjects.subject_name);

    return apiResponse({ data: subjects || [] });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'Branch Subjects API Error');
    return apiError('Internal Server Error', 500, error.message);
  }
}
