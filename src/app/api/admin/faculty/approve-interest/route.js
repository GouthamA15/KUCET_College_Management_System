import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectInterests, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const { interest_id, status } = body;

    if (!interest_id || !status) return apiError('Missing required fields', 400);
    if (!['APPROVED', 'REJECTED'].includes(status)) return apiError('Invalid status', 400);

    await db.transaction(async (tx) => {
      const interest = await tx.query.facultySubjectInterests.findFirst({
        where: eq(facultySubjectInterests.id, interest_id)
      });

      if (!interest) {
        throw new Error('NOT_FOUND');
      }

      await tx.update(facultySubjectInterests)
        .set({ status })
        .where(eq(facultySubjectInterests.id, interest_id));

      if (status === 'APPROVED') {
        const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
        
        // Prevent duplicate insertions
        const existing = await tx.query.facultySubjectAssignments.findFirst({
          where: and(
            eq(facultySubjectAssignments.faculty_id, interest.faculty_id),
            eq(facultySubjectAssignments.subject_code, interest.subject_code),
            eq(facultySubjectAssignments.branch, interest.branch),
            eq(facultySubjectAssignments.course_semester, interest.semester),
            eq(facultySubjectAssignments.academic_year, interest.academic_year),
            eq(facultySubjectAssignments.is_active, true)
          )
        });

        if (!existing) {
          await tx.insert(facultySubjectAssignments).values({
            faculty_id: interest.faculty_id,
            subject_code: interest.subject_code,
            subject_name: interest.subject_name,
            branch: interest.branch,
            course_semester: interest.semester,
            academic_term: academicTerm,
            academic_year: interest.academic_year,
            is_active: true
          });
        }
      }
    });

    return apiResponse({ message: `Interest ${status.toLowerCase()} successfully` });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return apiError('Interest not found', 404);
    logger.error('Approve Interest Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
