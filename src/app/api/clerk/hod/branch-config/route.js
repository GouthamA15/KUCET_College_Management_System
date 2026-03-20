import logger from '@/lib/logger';
import { db } from '@/db';
import { branchConfig } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const config = await db.query.branchConfig.findFirst({
      where: eq(branchConfig.branch, user.branch),
      orderBy: [desc(branchConfig.id)]
    });

    return apiResponse({ data: config || { branch: user.branch, mid_max: 20, assignment_max: 10 } });
  } catch (error) {
    logger.error('HOD Config API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { mid_max, assignment_max, academic_year, semester } = await req.json();

    await db.insert(branchConfig).values({
      branch: user.branch,
      academic_year: academic_year,
      semester: parseInt(semester),
      mid_max: parseInt(mid_max),
      assignment_max: parseInt(assignment_max)
    })
    .onDuplicateKeyUpdate({
      set: {
        mid_max: sql`VALUES(mid_max)`,
        assignment_max: sql`VALUES(assignment_max)`
      }
    });

    return apiResponse({ message: 'Configuration updated successfully' });
  } catch (error) {
    logger.error('HOD Config Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
