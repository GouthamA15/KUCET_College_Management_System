import logger from '@/lib/logger';
import { db } from '@/db';
import { semesters } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const academic_year = searchParams.get('academic_year');
    const semester = searchParams.get('semester');

    const query = db.select({
      id: semesters.id,
      academic_year: semesters.academic_year,
      semester: semesters.semester,
      start_date: semesters.start_date,
      end_date: semesters.end_date,
      weekend_pattern: semesters.weekend_pattern
    })
    .from(semesters);

    if (academic_year && semester) {
      query.where(and(
        eq(semesters.academic_year, academic_year),
        eq(semesters.semester, parseInt(semester))
      ));
    }
    
    const rows = await query.orderBy(desc(semesters.academic_year), desc(semesters.semester));
    return apiResponse({ data: rows });
  } catch (error) {
    logger.error('API_GET_SEMESTERS_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}
