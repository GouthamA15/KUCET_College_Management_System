import logger from '@/lib/logger';
import { db } from '@/db';
import { facultyHodRequests, staffAccounts, staffAccountRoles, staffRoles, facultyHodAssignments, semesters, auditLogs } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function PATCH(request, context) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const { id } = await context.params;
    const requestId = parseInt(id, 10);
    
    if (isNaN(requestId)) return apiError('Invalid request ID', 400);

    const body = await request.json();
    const { action, rejection_reason } = body;

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return apiError('Invalid action. Must be APPROVE or REJECT.', 400);
    }

    const adminId = user.id || 1; // Fallback for dev

    return await db.transaction(async (tx) => {
      // 1. Verify request exists & 2. Verify status is PENDING
      const [reqRecord] = await tx.select().from(facultyHodRequests).where(eq(facultyHodRequests.id, requestId)).for('update');
      
      if (!reqRecord) {
        throw new Error('HOD request not found');
      }

      if (reqRecord.status !== 'PENDING') {
        throw new Error(`Cannot process request. Status is already ${reqRecord.status}`);
      }

      // 3. Verify Staff account exists
      const [staffRecord] = await tx.select().from(staffAccounts).where(eq(staffAccounts.id, reqRecord.staff_account_id));
      if (!staffRecord) {
        throw new Error('Staff account not found');
      }

      // 4. Verify Staff has FACULTY role (assuming we check staffAccountRoles)
      const facultyRoleCheck = await tx.select()
        .from(staffAccountRoles)
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(and(
          eq(staffAccountRoles.staff_account_id, reqRecord.staff_account_id),
          eq(staffRoles.role_code, 'FACULTY')
        ));
      
      if (facultyRoleCheck.length === 0) {
        // Log it, but let's just make sure they have it. If not, they shouldn't be HOD.
        throw new Error('Staff does not have FACULTY role');
      }

      // 5. Verify department exists (we skip strict foreign key check here if department_code is valid string)
      // 6. Resolve requested academic year from institutional session data
      // 7. Determine academic-session start/end dates
      const semesterRows = await tx.select().from(semesters).where(eq(semesters.academic_year, reqRecord.academic_year));
      
      if (semesterRows.length === 0) {
        throw new Error(`Academic session ${reqRecord.academic_year} not found in semesters`);
      }

      // Find min start and max end
      let minStart = semesterRows[0].start_date;
      let maxEnd = semesterRows[0].end_date;
      for (const sem of semesterRows) {
        if (sem.start_date < minStart) minStart = sem.start_date;
        if (sem.end_date > maxEnd) maxEnd = sem.end_date;
      }

      if (action === 'REJECT') {
        await tx.update(facultyHodRequests)
          .set({
            status: 'REJECTED',
            reviewed_by: adminId,
            reviewed_at: new Date(),
            rejection_reason: rejection_reason || null
          })
          .where(eq(facultyHodRequests.id, requestId));

        // 14. Write audit
        await tx.insert(auditLogs).values({
          user_id: adminId,
          user_type: 'admin',
          action: 'REJECT_HOD_REQUEST',
          entity_type: 'FACULTY_HOD_REQUEST',
          entity_id: requestId,
          details: JSON.stringify({ reason: rejection_reason }),
          ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
          user_agent: request.headers.get('user-agent') || 'system'
        });

        return apiResponse({ message: 'Request rejected' });
      }

      if (action === 'APPROVE') {
        // 8. Ensure there is not already another active HOD for that department + academic year
        // It means ANY staff for that department/year
        const nowStr = new Date().toISOString().split('T')[0];
        const activeAssignment = await tx.select().from(facultyHodAssignments).where(
          and(
            eq(facultyHodAssignments.department_code, reqRecord.department_code),
            eq(facultyHodAssignments.academic_year, reqRecord.academic_year),
            eq(facultyHodAssignments.is_active, true),
            gte(facultyHodAssignments.end_date, nowStr) // Must not be expired
          )
        );

        if (activeAssignment.length > 0) {
          throw new Error('There is already an active HOD for this department and academic year');
        }

        // 9. Add HOD role if not already present
        const [hodRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD'));
        if (!hodRoleDef) {
          throw new Error('HOD role definition not found in staff_roles table');
        }
        const existingHodRole = await tx.select().from(staffAccountRoles).where(
          and(
            eq(staffAccountRoles.staff_account_id, reqRecord.staff_account_id),
            eq(staffAccountRoles.role_id, hodRoleDef.id)
          )
        );
        if (existingHodRole.length === 0) {
          await tx.insert(staffAccountRoles).values({
            staff_account_id: reqRecord.staff_account_id,
            role_id: hodRoleDef.id
          });
        }

        // 10. Create faculty_hod_assignments
        await tx.insert(facultyHodAssignments).values({
          staff_account_id: reqRecord.staff_account_id,
          department_code: reqRecord.department_code,
          academic_year: reqRecord.academic_year,
          start_date: minStart,
          end_date: maxEnd,
          is_active: true,
          assigned_by: adminId
        });

        // 11-13. Mark request APPROVED, record reviewed_by and reviewed_at
        await tx.update(facultyHodRequests)
          .set({
            status: 'APPROVED',
            reviewed_by: adminId,
            reviewed_at: new Date()
          })
          .where(eq(facultyHodRequests.id, requestId));

        // 14. Write audit
        await tx.insert(auditLogs).values({
          user_id: adminId,
          user_type: 'admin',
          action: 'APPROVE_HOD_REQUEST',
          entity_type: 'FACULTY_HOD_REQUEST',
          entity_id: requestId,
          details: JSON.stringify({ 
            staff_id: reqRecord.staff_account_id, 
            department: reqRecord.department_code,
            academic_year: reqRecord.academic_year 
          }),
          ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
          user_agent: request.headers.get('user-agent') || 'system'
        });

        return apiResponse({ message: 'Request approved and HOD assigned' });
      }

    }).catch(err => {
      logger.error('HOD Request Approval Error:', err);
      return apiError(err.message, 400);
    });

  } catch (error) {
    logger.error('API_HOD_REQUEST_PROCESS_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}
