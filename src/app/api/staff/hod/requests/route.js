import logger from '@/lib/logger';
import { db } from '@/db';
import { facultyHodRequests } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(_request) {
  try {
    const user = await getAuthUser('faculty'); // Staff needs to be logged in, ideally with 'faculty' role to request HOD
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const requests = await db.query.facultyHodRequests.findMany({
      where: eq(facultyHodRequests.staff_account_id, user.id),
      orderBy: [desc(facultyHodRequests.created_at)]
    });

    return apiResponse({ data: requests });
  } catch (error) {
    logger.error('HOD Requests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const body = await request.json();
    const { department_code, academic_year } = body;

    if (!department_code || !academic_year) {
      return apiError('Missing required fields', 400);
    }

    const existingPending = await db.query.facultyHodRequests.findFirst({
      where: and(
        eq(facultyHodRequests.staff_account_id, user.id),
        eq(facultyHodRequests.department_code, department_code),
        eq(facultyHodRequests.academic_year, academic_year),
        eq(facultyHodRequests.status, 'PENDING')
      )
    });

    if (existingPending) {
      return apiError('A pending HOD request already exists for this department and year', 400);
    }

    await db.insert(facultyHodRequests).values({
      staff_account_id: user.id,
      department_code,
      academic_year,
      status: 'PENDING'
    });

    return apiResponse({ message: 'HOD Access request submitted successfully' });
  } catch (error) {
    logger.error('HOD Request Submit Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
