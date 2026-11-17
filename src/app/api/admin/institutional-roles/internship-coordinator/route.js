import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  staffAccounts, 
  staffRoles, 
  staffAccountRoles, 
  staffAcademicAffiliations, 
  academicDepartments 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { z } from 'zod';

const InternshipCoordinatorMutationSchema = z.object({
  action: z.enum(['DESIGNATE', 'REVOKE'], { message: 'Action must be DESIGNATE or REVOKE' }),
  staff_id: z.coerce.number().int().positive().optional(),
  assignment_id: z.coerce.number().int().positive().optional(),
  academic_year: z.string().regex(/^(\d{4}-\d{2}|\d{4}-\d{4})$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  reason: z.string().optional(),
}).refine(data => {
  if (data.action === 'DESIGNATE' && !data.staff_id) {
    return false;
  }
  return true;
}, {
  message: 'Staff ID is required when action is DESIGNATE',
  path: ['staff_id']
});

export async function GET() {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    // 1. Get current active internship coordinator
    const activeCoordinator = await CoordinatorAssignmentService.getActiveInternshipCoordinator();

    // 2. Get past coordinator assignment history
    const history = await CoordinatorAssignmentService.getCoordinatorAssignments({
      coordinatorType: 'INTERNSHIP',
      includeInactive: true,
    });

    // 3. Get eligible faculty list for assignment dropdown
    const facultyList = await db
      .select({
        id: staffAccounts.id,
        name: staffAccounts.name,
        email: staffAccounts.email,
        employee_id: staffAccounts.employee_id,
        designation: staffAccounts.designation,
        account_status: staffAccounts.account_status,
        department_code: academicDepartments.department_code,
        department_name: academicDepartments.department_name,
      })
      .from(staffAccounts)
      .innerJoin(staffAccountRoles, eq(staffAccounts.id, staffAccountRoles.staff_account_id))
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .leftJoin(staffAcademicAffiliations, eq(staffAccounts.id, staffAcademicAffiliations.staff_account_id))
      .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .where(
        and(
          eq(staffRoles.role_code, 'FACULTY'),
          eq(staffAccounts.account_status, 'ACTIVE')
        )
      )
      .orderBy(staffAccounts.name);

    // Deduplicate faculty list
    const seenFaculty = new Set();
    const eligibleFaculty = [];
    facultyList.forEach(f => {
      if (!seenFaculty.has(f.id)) {
        seenFaculty.add(f.id);
        eligibleFaculty.push(f);
      }
    });

    return apiResponse({
      success: true,
      data: {
        active_coordinator: activeCoordinator,
        history,
        eligible_faculty: eligibleFaculty,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_INTERNSHIP_COORDINATOR_ERROR]');
    return apiError(err.message, 500);
  }
}

export async function POST(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return apiError('Invalid JSON payload', 400);
  }

  const parsed = InternshipCoordinatorMutationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation Error', 400, parsed.error.format());
  }

  const { action, staff_id: staffId, assignment_id: assignmentId, academic_year, start_date, end_date, reason } = parsed.data;
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  try {
    if (action === 'DESIGNATE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();
      const defaultAcademicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      const result = await CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: staffId,
        coordinatorType: 'INTERNSHIP',
        academicYear: academic_year || defaultAcademicYear,
        startDate: start_date || todayStr,
        endDate: end_date || null,
        assignedBy: user.id,
        ip,
        userAgent,
      });

      return apiResponse({
        success: true,
        message: 'Internship Coordinator successfully designated',
        data: result,
      }, 201);
    }

    if (action === 'REVOKE') {
      let targetAssignmentId = assignmentId;

      if (!targetAssignmentId) {
        const active = await CoordinatorAssignmentService.getActiveInternshipCoordinator();
        if (!active) {
          return apiError('No active Internship Coordinator found to revoke', 404);
        }
        targetAssignmentId = active.id;
      }

      const result = await CoordinatorAssignmentService.revokeCoordinator(targetAssignmentId, {
        revokedBy: user.id,
        reason: reason || 'Administrative role reassignment',
        ip,
        userAgent,
      });

      return apiResponse({
        success: true,
        message: 'Internship Coordinator role successfully revoked',
        data: result,
      });
    }

    return apiError('Invalid action', 400);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message, action, staffId }, '[INTERNSHIP_COORDINATOR_MUTATION_ERROR]');
    return apiError(err.message, status);
  }
}
