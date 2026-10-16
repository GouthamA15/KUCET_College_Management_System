import logger from '@/lib/logger';
import { db } from '@/db';
import { branchConfig } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const requestedBranch = req.nextUrl?.searchParams?.get('branch');
    const targetBranch = requestedBranch || user.branch || user.hod_department_code;

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && requestedBranch && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    if (!targetBranch && user.role !== 'admin') {
      return apiError('Branch not assigned to your profile', 400);
    }

    const config = await db.query.branchConfig.findFirst({
      where: eq(branchConfig.branch, targetBranch),
      orderBy: [desc(branchConfig.id)]
    });

    return apiResponse({ data: config || { branch: targetBranch, mid_max: 20, assignment_max: 10 } });
  } catch (error) {
    logger.error('HOD Config API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { mid_max, assignment_max, academic_year, semester, branch } = body;
    const targetBranch = branch || user.branch || user.hod_department_code;

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(targetBranch)) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} branch.`, 403);
    }

    await db.insert(branchConfig).values({
      branch: targetBranch,
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
