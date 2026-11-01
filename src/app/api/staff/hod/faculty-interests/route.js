import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectInterests, 
  staffAccounts, 
  collegeInfo as collegeInfoTable, 
  facultySubjectAssignments,
  academicDepartments
} from '@/db/schema';
import { eq, and, desc, or, inArray, notInArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { 
  canReviewSubjectInterest,
  assertAcademicYearNotLocked,
  checkAllocationConflicts,
  canOverrideAllocationConflict,
  notifyPrincipalLeadershipSelfAllocation
} from '@/lib/academic-authorization';
import { z } from 'zod';

const interestUpdateSchema = z.object({
  interest_id: z.coerce.number().int().positive(),
  status: z.enum(['APPROVED', 'REJECTED']),
  rejection_reason: z.string().optional(),
  override_conflict: z.boolean().optional(),
  override_reason: z.string().optional()
});

export const GET = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (_request, { user }) => {
    try {
      const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
      const collegeInfo = collegeRows[0] || null;
      const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

      const isHod = !!user.hod_department_code || !!user.is_hod;
      const isCoordinator = !!user.is_first_year_coordinator;
      const isAdmin = user.role === 'admin' || !!user.is_principal;

      if (!isHod && !isCoordinator && !isAdmin) {
        return apiError('Unauthorized - Active HOD or Coordinator Assignment Required', 403);
      }

      // 1. Resolve all program codes under the HOD's department (if HOD)
      let authorizedCodes = [];
      if (user.hod_department_code) {
        authorizedCodes.push(user.hod_department_code);
        const hodDept = await db.select({ id: academicDepartments.id })
          .from(academicDepartments)
          .where(eq(academicDepartments.department_code, user.hod_department_code))
          .limit(1);

        if (hodDept.length > 0) {
          const { academicPrograms } = require('@/db/schema');
          const programs = await db.select({ code: academicPrograms.program_code })
            .from(academicPrograms)
            .where(eq(academicPrograms.department_id, hodDept[0].id));
          
          programs.forEach(p => {
            if (!authorizedCodes.includes(p.code)) {
              authorizedCodes.push(p.code);
            }
          });
        }
      }

      // 2. Build where condition based on role capabilities:
      // - Coordinator sees Semesters 1 & 2 across ALL branches.
      // - HOD sees authorizedCodes across Semesters 3-8 (or all if also coordinator).
      // - Admin sees all.
      let scopeCondition;
      if (isAdmin) {
        scopeCondition = undefined;
      } else if (isCoordinator && isHod) {
        scopeCondition = or(
          inArray(facultySubjectInterests.department_code, authorizedCodes),
          inArray(facultySubjectInterests.branch, authorizedCodes),
          inArray(facultySubjectInterests.semester, [1, 2])
        );
      } else if (isCoordinator) {
        scopeCondition = inArray(facultySubjectInterests.semester, [1, 2]);
      } else {
        // HOD responsible for subject branch: Semesters 3-8 routed to HOD
        scopeCondition = and(
          or(
            inArray(facultySubjectInterests.department_code, authorizedCodes),
            inArray(facultySubjectInterests.branch, authorizedCodes)
          ),
          notInArray(facultySubjectInterests.semester, [1, 2])
        );
      }

      const yearCondition = or(
        eq(facultySubjectInterests.academic_year, currentAcademicYear),
        eq(facultySubjectInterests.status, 'PENDING')
      );

      const finalCondition = scopeCondition ? and(scopeCondition, yearCondition) : yearCondition;

      // 3. Query faculty subject interests
      const rawInterests = await db.select()
        .from(facultySubjectInterests)
        .where(finalCondition)
        .orderBy(desc(facultySubjectInterests.created_at));

      if (rawInterests.length === 0) {
        return apiResponse({ data: [] });
      }

      const requestedStaffIds = [...new Set(rawInterests.map(i => i.staff_account_id))];

      // 4. Fetch the corresponding Faculty staff details
      const facultyDetails = await db.select({
        id: staffAccounts.id,
        name: staffAccounts.name,
        employee_id: staffAccounts.employee_id
      })
      .from(staffAccounts)
      .where(inArray(staffAccounts.id, requestedStaffIds));

      const facultyMap = {};
      for (const row of facultyDetails) {
        facultyMap[row.id] = { name: row.name, employee_id: row.employee_id };
      }

      // 5. Resolve assignments separately
      const activeAssignments = await db.select({
        subject_code: facultySubjectAssignments.subject_code,
        branch: facultySubjectAssignments.branch,
        course_semester: facultySubjectAssignments.course_semester,
        academic_year: facultySubjectAssignments.academic_year,
        faculty_name: staffAccounts.name
      })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .where(eq(facultySubjectAssignments.is_active, true));

      // Group active assignments by subject
      const allocationMap = {};
      for (const asgn of activeAssignments) {
        const key = `${asgn.subject_code}|${asgn.branch}|${asgn.course_semester}|${asgn.academic_year}`;
        if (!allocationMap[key]) allocationMap[key] = [];
        allocationMap[key].push(asgn.faculty_name);
      }

      // 6. Assemble response
      const interests = rawInterests.map(i => {
        const key = `${i.subject_code}|${i.branch}|${i.semester}|${i.academic_year}`;
        const allocatedNames = allocationMap[key] ? allocationMap[key].join(', ') : null;
        
        return {
          id: i.id,
          staff_account_id: i.staff_account_id,
          subject_code: i.subject_code,
          subject_name: i.subject_name,
          branch: i.branch,
          department_code: i.department_code,
          semester: i.semester,
          academic_year: i.academic_year,
          status: i.status,
          created_at: i.created_at,
          updated_at: i.updated_at,
          faculty_name: facultyMap[i.staff_account_id]?.name || 'Unknown',
          employee_id: facultyMap[i.staff_account_id]?.employee_id || 'Unknown',
          allocated_faculty_name: allocatedNames
        };
      });

      // Sort: PENDING first, then by created_at descending
      interests.sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return new Date(b.created_at).getTime() < new Date(a.created_at).getTime() ? 1 : -1;
      });

      return apiResponse({ data: interests });
    } catch (error) {
      logger.error({ err: error.message, stack: error.stack }, 'Faculty Interests GET Error');
      return apiError('Unable to load faculty interests. Please try again.', 500);
    }
  }
});

export const POST = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  schema: interestUpdateSchema,
  handler: async (_request, { user, data }) => {
    const { 
      interest_id, 
      status, 
      rejection_reason,
      override_conflict = false,
      override_reason = ''
    } = data;

    try {
      let createdAssignmentId = null;
      let isSelfAllocation = false;
      let interestRecord = null;

      await db.transaction(async (tx) => {
        const interest = await tx.query.facultySubjectInterests.findFirst({
          where: eq(facultySubjectInterests.id, interest_id)
        });

        if (!interest) {
          const err = new Error('Interest not found');
          err.status = 404;
          throw err;
        }

        interestRecord = interest;

        if (interest.status !== 'PENDING') {
          const err = new Error('Only PENDING requests can be reviewed');
          err.status = 400;
          throw err;
        }

        // Authoritative Review & Self-Allocation Permission Check
        const reviewCheck = canReviewSubjectInterest(user, interest);
        if (!reviewCheck.allowed) {
          const err = new Error(reviewCheck.reason || 'Not authorized for this department or academic scope');
          err.status = 403;
          throw err;
        }

        isSelfAllocation = !!reviewCheck.isSelfAllocation;

        if (status === 'APPROVED') {
          // Academic-Year Locking Protection
          await assertAcademicYearNotLocked({
            academic_year: interest.academic_year,
            branch: interest.branch,
            semester: interest.semester
          });

          // Conflict & Workload Detection
          const conflictResult = await checkAllocationConflicts({
            faculty_id: interest.staff_account_id,
            subject_code: interest.subject_code,
            branch: interest.branch,
            semester: interest.semester,
            academic_year: interest.academic_year
          });

          if (conflictResult.hasConflict) {
            if (!override_conflict) {
              const err = new Error('Allocation conflict detected');
              err.status = 409;
              err.conflictDetails = {
                conflicts: conflictResult.conflicts,
                warnings: conflictResult.warnings,
                canOverride: true
              };
              throw err;
            }

            const overrideCheck = canOverrideAllocationConflict(user, {
              branch: interest.branch,
              semester: interest.semester,
              reason: override_reason
            });

            if (!overrideCheck.allowed) {
              const err = new Error(overrideCheck.reason || 'Insufficient override authorization or reason');
              err.status = 403;
              throw err;
            }
          }

          const existingAssignment = await tx.query.facultySubjectAssignments.findFirst({
            where: and(
              eq(facultySubjectAssignments.staff_account_id, interest.staff_account_id),
              eq(facultySubjectAssignments.subject_code, interest.subject_code),
              eq(facultySubjectAssignments.branch, interest.branch),
              eq(facultySubjectAssignments.course_semester, interest.semester),
              eq(facultySubjectAssignments.academic_year, interest.academic_year)
            )
          });

          if (existingAssignment) {
            createdAssignmentId = existingAssignment.id;
            if (!existingAssignment.is_active) {
              await tx.update(facultySubjectAssignments)
                .set({ is_active: true })
                .where(eq(facultySubjectAssignments.id, existingAssignment.id));
            }
          } else {
            const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
            
            const [insertRes] = await tx.insert(facultySubjectAssignments).values({
              staff_account_id: interest.staff_account_id,
              subject_code: interest.subject_code,
              subject_name: interest.subject_name,
              branch: interest.branch,
              course_semester: interest.semester,
              academic_term: academicTerm,
              academic_year: interest.academic_year,
              is_active: true
            });
            createdAssignmentId = insertRes?.insertId;
          }
        }

        await tx.update(facultySubjectInterests)
          .set({ 
             status,
             reviewed_by: user.id,
             reviewed_at: new Date(),
             rejection_reason: status === 'REJECTED' ? (rejection_reason || null) : null
          })
          .where(eq(facultySubjectInterests.id, interest_id));
      });

      // Post-transaction notifications and audit logs
      if (status === 'APPROVED' && isSelfAllocation && interestRecord) {
        await notifyPrincipalLeadershipSelfAllocation(_request, {
          actor: user,
          subject_code: interestRecord.subject_code,
          subject_name: interestRecord.subject_name,
          branch: interestRecord.branch,
          semester: interestRecord.semester,
          academic_year: interestRecord.academic_year,
          assignment_id: createdAssignmentId,
          override_reason: override_conflict ? override_reason : null
        });
      }

      return apiResponse({ 
        message: isSelfAllocation 
          ? 'Subject request self-allocated and assigned successfully' 
          : `Interest ${status.toLowerCase()} successfully`,
        assignment_id: createdAssignmentId
      });
    } catch (error) {
      if (error.status === 404 || error.message === 'Interest not found') return apiError('Interest not found', 404);
      if (error.status === 403 || error.message?.includes('Not authorized') || error.message?.includes('cannot review your own request')) {
        return apiError(error.message, 403);
      }
      if (error.status === 409) {
        return apiResponse({ 
          error: error.message || 'Allocation conflict detected',
          hasConflict: true,
          canOverride: true,
          conflicts: error.conflictDetails?.conflicts || [],
          warnings: error.conflictDetails?.warnings || []
        }, 409);
      }
      if (error.status === 400) return apiError(error.message, 400);
      logger.error('Approve Interest Error:', error);
      throw error;
    }
  }
});

