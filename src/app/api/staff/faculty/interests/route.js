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

    const existingPending = await db.query.facultySubjectInterests.findFirst({
      where: and(
        eq(facultySubjectInterests.staff_account_id, user.id),
        eq(facultySubjectInterests.subject_code, subject_code),
        eq(facultySubjectInterests.branch, branch),
        eq(facultySubjectInterests.semester, semester),
        eq(facultySubjectInterests.academic_year, academic_year),
        eq(facultySubjectInterests.status, 'PENDING')
      )
    });

    if (existingPending) {
      return apiError('A pending interest already exists for this subject', 400);
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
