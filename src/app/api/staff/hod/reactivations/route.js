import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentReactivationRequests, 
  students
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDING_HOD';

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
      student_status: students.student_status
    })
    .from(studentReactivationRequests)
    .innerJoin(students, eq(studentReactivationRequests.student_id, students.id))
    .where(and(...conditions))
    .orderBy(desc(studentReactivationRequests.created_at));

    // Department branch isolation for HOD / Principal
    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    const filtered = (user.role !== 'admin' && authorizedBranches.length > 0)
      ? rows.filter(r => authorizedBranches.includes(getBranchFromRoll(r.roll_no)))
      : rows;

    return apiResponse({ data: filtered });
  } catch (err) {
    logger.error('Error fetching HOD reactivation requests:', err);
    return apiError('Internal Server Error', 500);
  }
}
