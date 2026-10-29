import { db } from '@/db';
import { 
  facultyHodAssignments, 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles, 
  academicDepartments, 
  auditLogs 
} from '@/db/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear, deriveDefaultAcademicYear } from '@/lib/academic-utils';
import { isVerifiedDesignatedSupervisor } from '@/lib/academic-authorization';
import logger from '@/lib/logger';

const INSTITUTIONAL_DEPARTMENTS = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

async function checkSupervisorAuthority(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.is_principal) {
    if (user.is_designated_supervisor) return true;
    return await isVerifiedDesignatedSupervisor(user.id, user.email);
  }
  return false;
}

/**
 * GET /api/staff/hod/assignments
 * List current HOD assignments and eligible faculty for designated Supervisor / Admin oversight.
 */
export const GET = wrapHandler({
  auth: ['admin', 'hod', 'faculty'],
  handler: async (_request, { user }) => {
    const isAuthorized = await checkSupervisorAuthority(user);
    if (!isAuthorized) {
      return apiError('Forbidden - Designated Academic Supervisor or Super Admin authority required.', 403);
    }

    const currentYear = await getCollegeAcademicYear() || deriveDefaultAcademicYear();

    // 1. Fetch all active and recent HOD assignments
    const assignments = await db.select({
      id: facultyHodAssignments.id,
      staff_account_id: facultyHodAssignments.staff_account_id,
      department_code: facultyHodAssignments.department_code,
      academic_year: facultyHodAssignments.academic_year,
      start_date: facultyHodAssignments.start_date,
      end_date: facultyHodAssignments.end_date,
      is_active: facultyHodAssignments.is_active,
      staff_name: staffAccounts.name,
      staff_email: staffAccounts.email,
      created_at: facultyHodAssignments.created_at
    })
    .from(facultyHodAssignments)
    .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
    .orderBy(desc(facultyHodAssignments.is_active), facultyHodAssignments.department_code);

    // 2. Fetch list of eligible active faculty members for assignment
    const eligibleFaculty = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      status: staffAccounts.status
    })
    .from(staffAccounts)
    .where(eq(staffAccounts.status, 'ACTIVE'))
    .orderBy(staffAccounts.name);

    return {
      academic_year: currentYear,
      departments: INSTITUTIONAL_DEPARTMENTS,
      assignments,
      eligible_faculty: eligibleFaculty
    };
  }
});

/**
 * POST /api/staff/hod/assignments
 * Assign or reassign Head of Department.
 * Strictly limited to assignment lifecycle: no credential modification or account deactivation.
 */
export const POST = wrapHandler({
  auth: ['admin', 'hod', 'faculty'],
  handler: async (request, { user }) => {
    const isAuthorized = await checkSupervisorAuthority(user);
    if (!isAuthorized) {
      return apiError('Forbidden - Designated Academic Supervisor or Super Admin authority required.', 403);
    }

    const body = await request.json();
    const { department_code, staff_account_id, academic_year, confirm_reassign = false } = body;

    if (!department_code || !staff_account_id) {
      return apiError('Missing required fields: department_code and staff_account_id are required.', 400);
    }

    const normDept = String(department_code).toUpperCase().trim();
    if (!INSTITUTIONAL_DEPARTMENTS.includes(normDept)) {
      return apiError(`Invalid department_code. Must be one of: ${INSTITUTIONAL_DEPARTMENTS.join(', ')}`, 400);
    }

    const targetStaffId = Number(staff_account_id);
    if (!targetStaffId || targetStaffId <= 0) {
      return apiError('Invalid staff_account_id.', 400);
    }

    // Verify target staff member exists and is active
    const targetStaff = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      status: staffAccounts.status
    })
    .from(staffAccounts)
    .where(eq(staffAccounts.id, targetStaffId))
    .limit(1);

    if (targetStaff.length === 0 || targetStaff[0].status !== 'ACTIVE') {
      return apiError('Target staff member must be an active account.', 400);
    }

    const systemYear = await getCollegeAcademicYear();
    const resolvedYear = academic_year || systemYear || deriveDefaultAcademicYear();
    const todayStr = new Date().toISOString().split('T')[0];

    return await db.transaction(async (tx) => {
      // Check for conflicting active HOD for this department and academic year
      const existingHOD = await tx.select({
        id: staffAccounts.id,
        name: staffAccounts.name,
        assignment_id: facultyHodAssignments.id
      })
      .from(facultyHodAssignments)
      .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
      .where(and(
        eq(facultyHodAssignments.department_code, normDept),
        eq(facultyHodAssignments.academic_year, resolvedYear),
        eq(facultyHodAssignments.is_active, true),
        ne(facultyHodAssignments.staff_account_id, targetStaffId)
      ))
      .limit(1);

      if (existingHOD.length > 0) {
        if (!confirm_reassign) {
          const err = new Error(`Conflict: ${existingHOD[0].name} is currently the active HOD for ${normDept} in ${resolvedYear}.`);
          err.statusCode = 409;
          err.conflictDetails = {
            conflict: true,
            current_hod: {
              id: existingHOD[0].id,
              name: existingHOD[0].name
            },
            department_code: normDept,
            academic_year: resolvedYear
          };
          throw err;
        }

        // Transactional reassignment: Deactivate predecessor assignment without touching user account credentials
        await tx.update(facultyHodAssignments).set({
          is_active: false,
          end_date: todayStr
        }).where(and(
          eq(facultyHodAssignments.department_code, normDept),
          eq(facultyHodAssignments.academic_year, resolvedYear),
          eq(facultyHodAssignments.is_active, true)
        ));

        // Check if previous HOD has other active HOD roles; if not, remove HOD role from staffAccountRoles
        const remainingHod = await tx.select({ id: facultyHodAssignments.id })
          .from(facultyHodAssignments)
          .where(and(
            eq(facultyHodAssignments.staff_account_id, existingHOD[0].id),
            eq(facultyHodAssignments.is_active, true)
          ))
          .limit(1);

        if (remainingHod.length === 0) {
          const [hodRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD')).limit(1);
          if (hodRoleDef) {
            await tx.delete(staffAccountRoles).where(and(
              eq(staffAccountRoles.staff_account_id, existingHOD[0].id),
              eq(staffAccountRoles.role_id, hodRoleDef.id)
            ));
          }
        }
      }

      // Ensure HOD role definition exists
      let [hodRole] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD')).limit(1);
      if (!hodRole) {
        const [insRole] = await tx.insert(staffRoles).values({
          role_code: 'HOD',
          role_name: 'Head of Department',
          description: 'Departmental Academic Leader'
        });
        hodRole = { id: insRole.insertId };
      }

      // Attach HOD role to newly appointed staff member
      const existingRoleAssignment = await tx.select().from(staffAccountRoles).where(and(
        eq(staffAccountRoles.staff_account_id, targetStaffId),
        eq(staffAccountRoles.role_id, hodRole.id)
      )).limit(1);

      if (existingRoleAssignment.length === 0) {
        await tx.insert(staffAccountRoles).values({
          staff_account_id: targetStaffId,
          role_id: hodRole.id,
          assigned_by: user.id
        });
      }

      // Create new HOD assignment record
      const [insertRes] = await tx.insert(facultyHodAssignments).values({
        staff_account_id: targetStaffId,
        department_code: normDept,
        academic_year: resolvedYear,
        start_date: todayStr,
        is_active: true,
        assigned_by: user.id
      });

      // Audit the operation
      await tx.insert(auditLogs).values({
        user_id: user.id,
        user_type: user.role === 'admin' ? 'admin' : 'staff',
        action: existingHOD.length > 0 ? 'HOD_REASSIGNED' : 'HOD_ASSIGNED',
        target_type: 'faculty_hod_assignments',
        target_id: String(insertRes.insertId),
        payload_after: {
          department_code: normDept,
          academic_year: resolvedYear,
          staff_account_id: targetStaffId,
          staff_name: targetStaff[0].name,
          assigned_by: user.id
        }
      });

      logger.info({
        action: existingHOD.length > 0 ? 'HOD_REASSIGNED' : 'HOD_ASSIGNED',
        dept: normDept,
        staffId: targetStaffId,
        assignedBy: user.id
      }, 'HOD assignment created successfully');

      return apiResponse({
        message: `Successfully appointed ${targetStaff[0].name} as HOD for ${normDept} (${resolvedYear}).`,
        assignment_id: insertRes.insertId
      }, 201);
    });
  }
});

/**
 * DELETE /api/staff/hod/assignments
 * Terminate an HOD assignment. Does not touch staff account credentials or status.
 */
export const DELETE = wrapHandler({
  auth: ['admin', 'hod', 'faculty'],
  handler: async (request, { user }) => {
    const isAuthorized = await checkSupervisorAuthority(user);
    if (!isAuthorized) {
      return apiError('Forbidden - Designated Academic Supervisor or Super Admin authority required.', 403);
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = Number(searchParams.get('assignment_id') || searchParams.get('id'));

    if (!assignmentId || assignmentId <= 0) {
      return apiError('Valid assignment_id is required.', 400);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return await db.transaction(async (tx) => {
      const assignment = await tx.select().from(facultyHodAssignments).where(eq(facultyHodAssignments.id, assignmentId)).limit(1);
      if (assignment.length === 0) {
        return apiError('HOD assignment not found.', 404);
      }

      await tx.update(facultyHodAssignments).set({
        is_active: false,
        end_date: todayStr
      }).where(eq(facultyHodAssignments.id, assignmentId));

      // Check if user has other active HOD roles
      const remaining = await tx.select({ id: facultyHodAssignments.id })
        .from(facultyHodAssignments)
        .where(and(
          eq(facultyHodAssignments.staff_account_id, assignment[0].staff_account_id),
          eq(facultyHodAssignments.is_active, true)
        ))
        .limit(1);

      if (remaining.length === 0) {
        const [hodRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD')).limit(1);
        if (hodRoleDef) {
          await tx.delete(staffAccountRoles).where(and(
            eq(staffAccountRoles.staff_account_id, assignment[0].staff_account_id),
            eq(staffAccountRoles.role_id, hodRoleDef.id)
          ));
        }
      }

      await tx.insert(auditLogs).values({
        user_id: user.id,
        user_type: user.role === 'admin' ? 'admin' : 'staff',
        action: 'HOD_ASSIGNMENT_TERMINATED',
        target_type: 'faculty_hod_assignments',
        target_id: String(assignmentId),
        payload_after: { assignment_id: assignmentId, end_date: todayStr }
      });

      return { message: 'HOD assignment terminated successfully.' };
    });
  }
});
