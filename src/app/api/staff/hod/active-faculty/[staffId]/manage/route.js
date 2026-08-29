import { db } from '@/db';
import { 
  staffAccounts, 
  staffRoles, 
  staffAccountRoles, 
  staffAcademicAffiliations, 
  academicDepartments, 
  academicPrograms,
  facultySubjectAssignments,
  facultySubjectInterests,
  userSessions,
  refreshTokens,
  auditLogs,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { z } from 'zod';

// Helper to verify HOD authorization for a specific staff member
async function verifyHodAccess(user, targetStaffId) {
  if (!user.hod_department_code) return false;

  // Resolve all program codes under the HOD's department
  const hodDept = await db.select({ id: academicDepartments.id })
    .from(academicDepartments)
    .where(eq(academicDepartments.department_code, user.hod_department_code))
    .limit(1);

  let authorizedCodes = [user.hod_department_code];

  if (hodDept.length > 0) {
    const programs = await db.select({ code: academicPrograms.program_code })
      .from(academicPrograms)
      .where(eq(academicPrograms.department_id, hodDept[0].id));
    
    programs.forEach(p => {
      if (!authorizedCodes.includes(p.code)) {
        authorizedCodes.push(p.code);
      }
    });
  }

  const targetFacultyRows = await db.select({
    id: staffAccounts.id,
    account_status: staffAccounts.account_status,
    role_code: staffRoles.role_code
  })
  .from(staffAccounts)
  .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
  .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
  .innerJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
  .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
  .where(and(
    eq(staffAccounts.id, targetStaffId),
    eq(academicDepartments.department_code, user.hod_department_code)
  ));

  if (targetFacultyRows.length === 0) return false;
  
  // HOD cannot manage Admin or non-Faculty
  const hasAdmin = targetFacultyRows.some(r => r.role_code === 'ADMIN');
  const hasFaculty = targetFacultyRows.some(r => r.role_code === 'FACULTY');
  
  if (hasAdmin || !hasFaculty) return false;

  return { targetFaculty: targetFacultyRows[0], authorizedCodes };
}

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user, context }) => {
    const resolvedParams = await context.params;
    const targetStaffId = parseInt(resolvedParams.staffId, 10);
    if (isNaN(targetStaffId)) return apiError('Invalid staff ID', 400);

    const access = await verifyHodAccess(user, targetStaffId);
    if (!access) return apiError('Unauthorized or invalid faculty', 403);

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    const assignments = await db.select()
      .from(facultySubjectAssignments)
      .where(eq(facultySubjectAssignments.staff_account_id, targetStaffId))
      .orderBy(desc(facultySubjectAssignments.is_active));

    const requests = await db.select()
      .from(facultySubjectInterests)
      .where(and(
        eq(facultySubjectInterests.staff_account_id, targetStaffId),
        eq(facultySubjectInterests.status, 'PENDING'),
        eq(facultySubjectInterests.academic_year, currentAcademicYear)
      ));

    return apiResponse({
      data: {
        account_status: access.targetFaculty.account_status,
        assignments,
        requests
      }
    });
  }
});

const patchSchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'DISABLED']).optional(),
  subjectChanges: z.array(z.object({
    assignmentId: z.number().int().positive(),
    enabled: z.boolean()
  })).optional(),
  requestedSubjects: z.array(z.object({
    interestId: z.number().int().positive(),
    enabled: z.boolean()
  })).optional()
});

export const PATCH = wrapHandler({
  auth: 'hod',
  schema: patchSchema,
  handler: async (req, { user, data, context }) => {
    const resolvedParams = await context.params;
    const targetStaffId = parseInt(resolvedParams.staffId, 10);
    if (isNaN(targetStaffId)) return apiError('Invalid staff ID', 400);

    const access = await verifyHodAccess(user, targetStaffId);
    if (!access) return apiError('Unauthorized or invalid faculty', 403);

    const currentStatus = access.targetFaculty.account_status;

    await db.transaction(async (tx) => {
      // 1. Account Status
      if (data.accountStatus && data.accountStatus !== currentStatus) {
        if (currentStatus === 'SUSPENDED' || currentStatus === 'PENDING_ACTIVATION') {
          throw new Error('Cannot change status of suspended or unactivated account');
        }

        await tx.update(staffAccounts)
          .set({ account_status: data.accountStatus })
          .where(eq(staffAccounts.id, targetStaffId));

        if (data.accountStatus === 'DISABLED') {
          await tx.delete(userSessions).where(and(
            eq(userSessions.user_id, targetStaffId), 
            eq(userSessions.user_type, 'STAFF')
          ));
          await tx.delete(refreshTokens).where(and(
            eq(refreshTokens.user_id, targetStaffId.toString()), 
            eq(refreshTokens.user_type, 'staff')
          ));
        }

        await tx.insert(auditLogs).values({
          action: 'STAFF_STATUS_UPDATE',
          user_id: user.id,
          user_type: 'staff',
          target_id: targetStaffId.toString(),
          target_type: 'staff_accounts',
          payload_after: { previous_status: currentStatus, new_status: data.accountStatus, managed_by_hod_dept: user.hod_department_code },
          ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1'
        });
      }

      // 2. Subject Assignment Changes
      if (data.subjectChanges && data.subjectChanges.length > 0) {
        for (const change of data.subjectChanges) {
          // Verify assignment belongs to faculty
          const existing = await tx.select().from(facultySubjectAssignments).where(and(
            eq(facultySubjectAssignments.id, change.assignmentId),
            eq(facultySubjectAssignments.staff_account_id, targetStaffId)
          )).limit(1);

          if (existing.length > 0 && existing[0].is_active !== change.enabled) {
            await tx.update(facultySubjectAssignments)
              .set({ is_active: change.enabled, updated_at: new Date() })
              .where(eq(facultySubjectAssignments.id, change.assignmentId));

            await tx.insert(auditLogs).values({
              action: change.enabled ? 'SUBJECT_ACCESS_GRANTED' : 'SUBJECT_ACCESS_REVOKED',
              user_id: user.id,
              user_type: 'staff',
              target_id: targetStaffId.toString(),
              target_type: 'faculty_subject_assignments',
              payload_after: { assignment_id: change.assignmentId, subject_code: existing[0].subject_code },
              ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1'
            });
          }
        }
      }

      // 3. Requested Subjects Approvals
      if (data.requestedSubjects && data.requestedSubjects.length > 0) {
        for (const reqSubject of data.requestedSubjects) {
          if (!reqSubject.enabled) continue; // Only process approvals

          const interest = await tx.select().from(facultySubjectInterests).where(and(
            eq(facultySubjectInterests.id, reqSubject.interestId),
            eq(facultySubjectInterests.staff_account_id, targetStaffId),
            eq(facultySubjectInterests.status, 'PENDING')
          )).limit(1);

          if (interest.length > 0) {
            const i = interest[0];
            
            // Check duplicate assignment
            const duplicate = await tx.select().from(facultySubjectAssignments).where(and(
              eq(facultySubjectAssignments.staff_account_id, targetStaffId),
              eq(facultySubjectAssignments.subject_code, i.subject_code),
              eq(facultySubjectAssignments.branch, i.branch),
              eq(facultySubjectAssignments.course_semester, i.semester),
              eq(facultySubjectAssignments.academic_year, i.academic_year)
            )).limit(1);

            if (duplicate.length > 0) {
              // If exists, just activate it
              await tx.update(facultySubjectAssignments)
                .set({ is_active: true, updated_at: new Date() })
                .where(eq(facultySubjectAssignments.id, duplicate[0].id));
            } else {
              // Create new assignment
              await tx.insert(facultySubjectAssignments).values({
                staff_account_id: targetStaffId,
                subject_code: i.subject_code,
                subject_name: i.subject_name,
                branch: i.branch,
                course_semester: i.semester,
                academic_term: (i.semester % 2 === 0 ? 2 : 1),
                academic_year: i.academic_year,
                is_active: true
              });
            }

            // Mark request as APPROVED
            await tx.update(facultySubjectInterests)
              .set({
                status: 'APPROVED',
                reviewed_by: user.id,
                reviewed_at: new Date()
              })
              .where(eq(facultySubjectInterests.id, i.id));

            await tx.insert(auditLogs).values({
              action: 'FACULTY_INTEREST_APPROVED',
              user_id: user.id,
              user_type: 'staff',
              target_id: targetStaffId.toString(),
              target_type: 'faculty_subject_interests',
              payload_after: { interest_id: i.id, subject_code: i.subject_code },
              ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1'
            });
          }
        }
      }
    });

    return apiResponse({ message: 'Faculty updated successfully' });
  }
});
