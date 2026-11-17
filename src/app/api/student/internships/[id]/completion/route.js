import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const SubmitCompletionSchema = z.object({
  actual_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid completion date (YYYY-MM-DD) required'),
  remarks: z.string().max(2000).optional().nullable(),
  certificate_file: z.string().min(1, 'Completion certificate is mandatory'),
  certificate_filename: z.string().default('Completion_Certificate.pdf'),
  report_file: z.string().optional().nullable(),
  report_filename: z.string().default('Internship_Report.pdf'),
});

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { id: internshipId } = await params;
    const studentId = user.id || user.student_id;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = SubmitCompletionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await StudentInternshipService.submitCompletion({
      internshipId,
      studentId,
      actualCompletionDate: data.actual_completion_date,
      remarks: data.remarks || null,
      certificateFile: data.certificate_file,
      certificateFilename: data.certificate_filename,
      reportFile: data.report_file || null,
      reportFilename: data.report_filename,
      ip,
      userAgent,
    });

    return apiResponse(result);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[SUBMIT_COMPLETION_ERROR]');
    return apiError(err.message, status);
  }
}
