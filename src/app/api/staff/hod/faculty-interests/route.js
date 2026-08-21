import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectInterests, 
  staffAccounts, 
  collegeInfo as collegeInfoTable, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { z } from 'zod';

const interestUpdateSchema = z.object({
  interest_id: z.coerce.number().int().positive(),
  status: z.enum(['APPROVED', 'REJECTED'])
});

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user }) => {
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized - HOD Access Required', 401);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    const allocatedSubquery = db.select({
      names: sql`GROUP_CONCAT(${staffAccounts.name} SEPARATOR ', ')`.as('names'),
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.faculty_id, staffAccounts.id))
    .where(eq(facultySubjectAssignments.is_active, true))
    .groupBy(
      facultySubjectAssignments.subject_code,
      facultySubjectAssignments.branch,
      facultySubjectAssignments.course_semester,
      facultySubjectAssignments.academic_year
    )
    .as('asgn');

    const interests = await db.select({
      id: facultySubjectInterests.id,
      faculty_id: facultySubjectInterests.faculty_id,
      subject_code: facultySubjectInterests.subject_code,
      subject_name: facultySubjectInterests.subject_name,
      branch: facultySubjectInterests.branch,
      semester: facultySubjectInterests.semester,
      academic_year: facultySubjectInterests.academic_year,
      status: facultySubjectInterests.status,
      created_at: facultySubjectInterests.created_at,
      updated_at: facultySubjectInterests.updated_at,
      faculty_name: staffAccounts.name,
      employee_id: staffAccounts.employee_id,
      allocated_faculty_name: allocatedSubquery.names
    })
    .from(facultySubjectInterests)
    .innerJoin(staffAccounts, eq(facultySubjectInterests.faculty_id, staffAccounts.id))
    .leftJoin(allocatedSubquery, and(
      eq(facultySubjectInterests.subject_code, allocatedSubquery.subject_code),
      eq(facultySubjectInterests.branch, allocatedSubquery.branch),
      eq(facultySubjectInterests.semester, allocatedSubquery.course_semester),
      eq(facultySubjectInterests.academic_year, allocatedSubquery.academic_year)
    ))
    .where(and(
      eq(facultySubjectInterests.branch, user.branch), // HOD can only see their branch
      or(
        eq(facultySubjectInterests.academic_year, currentAcademicYear),
        eq(facultySubjectInterests.status, 'PENDING')
      )
    ))
    .orderBy(desc(sql`${facultySubjectInterests.status} = 'PENDING'`), desc(facultySubjectInterests.created_at));

    return apiResponse({ data: interests });
  }
});

export const POST = wrapHandler({
  auth: 'hod',
  schema: interestUpdateSchema,
  handler: async (_request, { user, data }) => {
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized - HOD Access Required', 401);
    }

    const { interest_id, status } = data;

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

        if (interest.branch !== user.branch) {
          const err = new Error('Not authorized for this branch');
          err.status = 403;
          throw err;
        }

        await tx.update(facultySubjectInterests)
          .set({ status })
          .where(eq(facultySubjectInterests.id, interest_id));

        if (status === 'APPROVED') {
          const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
          
          await tx.insert(facultySubjectAssignments).values({
            faculty_id: interest.faculty_id,
            subject_code: interest.subject_code,
            subject_name: interest.subject_name,
            branch: interest.branch,
            course_semester: interest.semester,
            academic_term: academicTerm,
            academic_year: interest.academic_year,
            is_active: true
          }).onDuplicateKeyUpdate({
            set: { is_active: true }
          });
        } else if (status === 'REJECTED') {
          await tx.update(facultySubjectAssignments)
            .set({ is_active: false })
            .where(and(
              eq(facultySubjectAssignments.faculty_id, interest.faculty_id),
              eq(facultySubjectAssignments.subject_code, interest.subject_code),
              eq(facultySubjectAssignments.branch, interest.branch),
              eq(facultySubjectAssignments.course_semester, interest.semester),
              eq(facultySubjectAssignments.academic_year, interest.academic_year),
              eq(facultySubjectAssignments.is_active, true)
            ));
        }
      });

      return apiResponse({ message: `Interest ${status.toLowerCase()} successfully` });
    } catch (error) {
      if (error.status === 404 || error.message === 'Interest not found') return apiError('Interest not found', 404);
      if (error.status === 403 || error.message === 'Not authorized for this branch') return apiError('Not authorized for this branch', 403);
      logger.error('HOD Approve Interest Error:', error);
      throw error;
    }
  }
});
