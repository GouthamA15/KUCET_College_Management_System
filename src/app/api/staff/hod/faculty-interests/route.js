import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectInterests, 
  staffAccounts, 
  collegeInfo as collegeInfoTable, 
  facultySubjectAssignments,
  staffAcademicAffiliations,
  academicDepartments,
  staffRoles,
  staffAccountRoles
} from '@/db/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { z } from 'zod';

const interestUpdateSchema = z.object({
  interest_id: z.coerce.number().int().positive(),
  status: z.enum(['APPROVED', 'REJECTED']),
  rejection_reason: z.string().optional()
});

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user }) => {
    try {
      const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
      const collegeInfo = collegeRows[0] || null;
      const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

      if (!user.hod_department_code) {
        return apiError('Unauthorized - Active HOD Assignment Required', 403);
      }

      // 1. Fetch eligible Faculty Staff IDs in the HOD's department
      const eligibleFaculty = await db.select({
        staff_id: staffAccounts.id,
        name: staffAccounts.name,
        employee_id: staffAccounts.employee_id
      })
      .from(staffAccounts)
      .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .innerJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
      .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .where(and(
        eq(staffRoles.role_code, 'FACULTY'),
        eq(academicDepartments.department_code, user.hod_department_code),
        eq(staffAccounts.is_active, true)
      ));

      const facultyMap = {};
      for (const row of eligibleFaculty) {
        facultyMap[row.staff_id] = { name: row.name, employee_id: row.employee_id };
      }
      
      const eligibleStaffIds = Object.keys(facultyMap).map(Number);
      
      if (eligibleStaffIds.length === 0) {
        return apiResponse({ data: [] });
      }

      // 2. Query faculty subject interests for these staff IDs
      const rawInterests = await db.select()
        .from(facultySubjectInterests)
        .where(and(
          inArray(facultySubjectInterests.staff_account_id, eligibleStaffIds),
          or(
            eq(facultySubjectInterests.academic_year, currentAcademicYear),
            eq(facultySubjectInterests.status, 'PENDING')
          )
        ))
        .orderBy(sql`${facultySubjectInterests.status} = 'PENDING' DESC`, desc(facultySubjectInterests.created_at));

      if (rawInterests.length === 0) {
        return apiResponse({ data: [] });
      }

      // 3. Resolve assignments separately
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

      // 4. Assemble response
      const interests = rawInterests.map(i => {
        const key = `${i.subject_code}|${i.branch}|${i.semester}|${i.academic_year}`;
        const allocatedNames = allocationMap[key] ? allocationMap[key].join(', ') : null;
        
        return {
          id: i.id,
          staff_account_id: i.staff_account_id,
          subject_code: i.subject_code,
          subject_name: i.subject_name,
          branch: i.branch,
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

      return apiResponse({ data: interests });
    } catch (error) {
      logger.error('Faculty Interests GET Error:', error);
      return apiError('Internal Server Error', 500);
    }
  }
});

export const POST = wrapHandler({
  auth: 'hod',
  schema: interestUpdateSchema,
  handler: async (_request, { user, data }) => {
    const { interest_id, status, rejection_reason } = data;

    try {
      await db.transaction(async (tx) => {
        const interest = await tx.query.facultySubjectInterests.findFirst({
          where: eq(facultySubjectInterests.id, interest_id)
        });

        if (!interest) {
          const err = new Error('Interest not found');
          err.status = 404;
          throw err;
        }

        if (interest.staff_account_id === user.id) {
          const err = new Error('You cannot review your own request');
          err.status = 403;
          throw err;
        }

        if (interest.status !== 'PENDING') {
          const err = new Error('Only PENDING requests can be reviewed');
          err.status = 400;
          throw err;
        }

        const affil = await tx.select({ dept_code: academicDepartments.department_code })
          .from(staffAcademicAffiliations)
          .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
          .where(eq(staffAcademicAffiliations.staff_account_id, interest.staff_account_id));
        
        const validDepartments = affil.map(a => a.dept_code);

        if (!user.hod_department_code || !validDepartments.includes(user.hod_department_code)) {
           const err = new Error('Not authorized for this department');
           err.status = 403;
           throw err;
        }

        if (status === 'APPROVED') {
          const existingAssignment = await tx.query.facultySubjectAssignments.findFirst({
            where: and(
              eq(facultySubjectAssignments.staff_account_id, interest.staff_account_id),
              eq(facultySubjectAssignments.subject_code, interest.subject_code),
              eq(facultySubjectAssignments.branch, interest.branch),
              eq(facultySubjectAssignments.course_semester, interest.semester),
              eq(facultySubjectAssignments.academic_year, interest.academic_year),
              eq(facultySubjectAssignments.is_active, true)
            )
          });

          if (existingAssignment) {
            const err = new Error('An active assignment already exists for this subject');
            err.status = 409;
            throw err;
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

        if (status === 'APPROVED') {
          const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
          
          await tx.insert(facultySubjectAssignments).values({
            staff_account_id: interest.staff_account_id,
            subject_code: interest.subject_code,
            subject_name: interest.subject_name,
            branch: interest.branch,
            course_semester: interest.semester,
            academic_term: academicTerm,
            academic_year: interest.academic_year,
            is_active: true
          });
        }
      });

      return apiResponse({ message: `Interest ${status.toLowerCase()} successfully` });
    } catch (error) {
      if (error.status === 404 || error.message === 'Interest not found') return apiError('Interest not found', 404);
      if (error.status === 403 || error.message === 'Not authorized for this department') return apiError('Not authorized for this department', 403);
      if (error.status === 409) return apiError(error.message, 409);
      if (error.status === 400) return apiError(error.message, 400);
      logger.error('HOD Approve Interest Error:', error);
      throw error;
    }
  }
});
