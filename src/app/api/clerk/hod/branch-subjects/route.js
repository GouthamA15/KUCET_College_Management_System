import { db } from '@/db';
import { syllabusSubjects, syllabusStructure } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    // Get all subjects associated with this branch across all semesters
    const subjects = await db.select({
      subject_code: syllabusSubjects.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      semester: syllabusStructure.semester
    })
    .from(syllabusSubjects)
    .join(syllabusStructure, eq(syllabusSubjects.subject_code, syllabusStructure.subject_code))
    .where(eq(syllabusStructure.branch, user.branch))
    .orderBy(syllabusStructure.semester, syllabusSubjects.subject_name);

    return apiResponse({ data: subjects });
  } catch (error) {
    console.error('Branch Subjects API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
