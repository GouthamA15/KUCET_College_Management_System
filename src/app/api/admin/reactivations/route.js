import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentReactivationRequests, 
  students,
  staffAccounts 
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user || user.role !== 'admin') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDING_ADMIN';

    const conditions = [];
    if (statusFilter && ['PENDING_HOD', 'PENDING_ADMIN', 'APPROVED', 'REJECTED'].includes(statusFilter.toUpperCase())) {
      conditions.push(eq(studentReactivationRequests.status, statusFilter.toUpperCase()));
    }

    const rows = await db.select({
      id: studentReactivationRequests.id,
      student_id: studentReactivationRequests.student_id,
      reason: studentReactivationRequests.reason,
      status: studentReactivationRequests.status,
      hod_reviewer_id: studentReactivationRequests.hod_reviewer_id,
      hod_reviewed_at: studentReactivationRequests.hod_reviewed_at,
      hod_decision: studentReactivationRequests.hod_decision,
      hod_remarks: studentReactivationRequests.hod_remarks,
      admin_reviewer_id: studentReactivationRequests.admin_reviewer_id,
      admin_reviewed_at: studentReactivationRequests.admin_reviewed_at,
      admin_decision: studentReactivationRequests.admin_decision,
      admin_remarks: studentReactivationRequests.admin_remarks,
      created_at: studentReactivationRequests.created_at,
      updated_at: studentReactivationRequests.updated_at,
      roll_no: students.roll_no,
      student_name: students.name,
      student_email: students.email,
      student_status: students.student_status,
      hod_name: staffAccounts.name
    })
    .from(studentReactivationRequests)
    .innerJoin(students, eq(studentReactivationRequests.student_id, students.id))
    .leftJoin(staffAccounts, eq(studentReactivationRequests.hod_reviewer_id, staffAccounts.id))
    .where(and(...conditions))
    .orderBy(desc(studentReactivationRequests.created_at));

    return apiResponse({ data: rows });
  } catch (err) {
    logger.error('Error fetching admin reactivation requests:', err);
    return apiError('Internal Server Error', 500);
  }
}
