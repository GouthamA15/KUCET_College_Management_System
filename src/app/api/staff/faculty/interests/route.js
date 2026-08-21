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
      where: eq(facultySubjectInterests.faculty_id, user.id),
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
    const { subject_code, subject_name, branch, semester, academic_year } = body;

    if (!subject_code || !subject_name || !branch || !semester || !academic_year) {
      return apiError('Missing required fields', 400);
    }

    const existing = await db.query.facultySubjectInterests.findFirst({
      where: and(
        eq(facultySubjectInterests.faculty_id, user.id),
        eq(facultySubjectInterests.subject_code, subject_code),
        eq(facultySubjectInterests.branch, branch),
        eq(facultySubjectInterests.semester, semester),
        eq(facultySubjectInterests.academic_year, academic_year)
      )
    });

    if (existing) {
      return apiError('Interest already submitted for this subject', 400);
    }

    await db.insert(facultySubjectInterests).values({
      faculty_id: user.id,
      subject_code,
      subject_name,
      branch,
      semester: parseInt(semester),
      academic_year
    });

    return apiResponse({ message: 'Interest submitted successfully' });
  } catch (error) {
    logger.error('Interest Submit Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
