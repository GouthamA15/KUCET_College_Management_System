import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const ApplyOpportunitySchema = z.object({
  statement_of_interest: z.string().max(2000).optional().nullable(),
  resume_file: z.string().optional().nullable(), // optional base64 data URI
});

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { id: opportunityId } = await params;
    const studentId = user.id || user.student_id;

    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      // Body may be empty if applying without statement
    }

    const parsed = ApplyOpportunitySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await StudentInternshipService.applyToOpportunity({
      studentId,
      opportunityId,
      statementOfInterest: parsed.data.statement_of_interest,
      resumeFile: parsed.data.resume_file,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: result.message,
      data: result,
    }, 201);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[APPLY_OPPORTUNITY_ERROR]');
    return apiError(err.message, status);
  }
}
