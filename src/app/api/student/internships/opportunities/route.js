import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipOpportunityService } from '@/services/internships/InternshipOpportunityService';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateRollNo } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const studentId = user.id || user.student_id;
    const [studentRecord] = await db
      .select({
        id: students.id,
        roll_no: students.roll_no,
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!studentRecord) {
      return apiError('Student record not found', 404);
    }

    const rollInfo = validateRollNo(studentRecord.roll_no);
    const student = {
      id: studentRecord.id,
      roll_no: studentRecord.roll_no,
      branch: rollInfo.isValid ? rollInfo.branch : '',
      academic_year: rollInfo.isValid ? `${rollInfo.entryYear}-${(Number(rollInfo.entryYear) + 1).toString().slice(-2)}` : '',
      cgpa: 0,
    };

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'ALL';
    const mode = searchParams.get('mode') || 'ALL';
    const eligibilityFilter = searchParams.get('eligibilityFilter') || 'ALL'; // 'ALL' | 'ELIGIBLE_ONLY'

    const opportunities = await InternshipOpportunityService.getStudentOpportunities(student, {
      search,
      category,
      mode,
      eligibilityFilter,
    });

    return apiResponse({
      success: true,
      data: {
        opportunities,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_STUDENT_OPPORTUNITIES_ERROR]');
    return apiError(err.message, 500);
  }
}
