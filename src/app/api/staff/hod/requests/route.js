import logger from '@/lib/logger';
import { db } from '@/db';
import { facultyHodRequests, facultyHodAssignments, staffAcademicAffiliations, academicDepartments } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(_request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const requests = await db.query.facultyHodRequests.findMany({
      where: eq(facultyHodRequests.staff_account_id, user.id),
      orderBy: [desc(facultyHodRequests.created_at)]
    });

    const assignments = await db.query.facultyHodAssignments.findMany({
      where: eq(facultyHodAssignments.staff_account_id, user.id),
      orderBy: [desc(facultyHodAssignments.created_at)]
    });

    return apiResponse({ data: { requests, assignments } });
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
    
    if (!academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    // Verify staff department is valid (Server-side identity verification)
    const affil = await db.select({ dept_code: academicDepartments.department_code })
        .from(staffAcademicAffiliations)
        .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
        .where(eq(staffAcademicAffiliations.staff_account_id, user.id));

    const validDepartments = affil.map(a => a.dept_code);
    if (!validDepartments.includes(department_code)) {
        return apiError(`Invalid department. You are not affiliated with ${department_code}`, 403);
    }

    // Check duplicate pending
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

    // Check if there is an active HOD assignment already for this year and department
    const existingActive = await db.query.facultyHodAssignments.findFirst({
      where: and(
        eq(facultyHodAssignments.staff_account_id, user.id),
        eq(facultyHodAssignments.department_code, department_code),
        eq(facultyHodAssignments.academic_year, academic_year),
        eq(facultyHodAssignments.is_active, true)
      )
    });

    if (existingActive) {
      return apiError('You are already an active HOD for this department and academic year', 400);
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
