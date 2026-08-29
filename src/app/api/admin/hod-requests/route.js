import logger from '@/lib/logger';
import { db } from '@/db';
import { facultyHodRequests, staffAccounts, facultyHodAssignments, academicDepartments } from '@/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(_request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const requests = await db.select({
        id: facultyHodRequests.id,
        staff_account_id: facultyHodRequests.staff_account_id,
        department_code: facultyHodRequests.department_code,
        department_name: academicDepartments.department_name,
        academic_year: facultyHodRequests.academic_year,
        status: facultyHodRequests.status,
        rejection_reason: facultyHodRequests.rejection_reason,
        reviewed_at: facultyHodRequests.reviewed_at,
        created_at: facultyHodRequests.created_at,
        name: staffAccounts.name,
        email: staffAccounts.email,
        employee_id: staffAccounts.employee_id,
        staff_category: staffAccounts.staff_category // Needed for frontend modal fallback
    })
    .from(facultyHodRequests)
    .innerJoin(staffAccounts, eq(facultyHodRequests.staff_account_id, staffAccounts.id))
    .leftJoin(academicDepartments, eq(facultyHodRequests.department_code, academicDepartments.department_code))
    .orderBy(desc(facultyHodRequests.created_at));
    
    // Fetch current active HODs
    const nowStr = new Date().toISOString().split('T')[0];
    const activeAssignments = await db.select({
      department_code: facultyHodAssignments.department_code,
      academic_year: facultyHodAssignments.academic_year,
      name: staffAccounts.name
    })
    .from(facultyHodAssignments)
    .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
    .where(and(
      eq(facultyHodAssignments.is_active, true),
      gte(facultyHodAssignments.end_date, nowStr)
    ));
    
    // Map them back to requests
    const enrichedRequests = requests.map(req => {
      const current = activeAssignments.find(a => 
        a.department_code === req.department_code && 
        a.academic_year === req.academic_year
      );
      return {
        ...req,
        current_hod_name: current ? current.name : null
      };
    });

    return apiResponse({ requests: enrichedRequests });
  } catch (error) {
    logger.error('Error fetching HOD requests:', error);
    return apiError('Internal Server Error', 500);
  }
}
