import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const ExternalRegistrationSchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required'),
  company_website: z.string().trim().url().optional().nullable().or(z.literal('')),
  company_location: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
  role_title: z.string().trim().min(2, 'Role title is required'),
  description: z.string().trim().optional().nullable(),
  mode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).default('HYBRID'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid start date (YYYY-MM-DD) required'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid end date (YYYY-MM-DD) required'),
  duration: z.string().trim().optional().nullable(),
  stipend: z.string().trim().optional().nullable(),
  supervisor_name: z.string().trim().optional().nullable(),
  supervisor_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  supervisor_phone: z.string().trim().optional().nullable(),
  skills_acquired: z.string().trim().optional().nullable(),
  offer_letter_file: z.string().min(1, 'Offer letter document is mandatory'),
  offer_letter_filename: z.string().default('Offer_Letter.pdf'),
});

export async function POST(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const studentId = user.id || user.student_id;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = ExternalRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await StudentInternshipService.registerExternalInternship({
      studentId,
      companyName: data.company_name,
      companyWebsite: data.company_website || null,
      companyLocation: data.company_location || null,
      industry: data.industry || null,
      roleTitle: data.role_title,
      description: data.description || null,
      mode: data.mode,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration || null,
      stipend: data.stipend || null,
      supervisorName: data.supervisor_name || null,
      supervisorEmail: data.supervisor_email || null,
      supervisorPhone: data.supervisor_phone || null,
      skillsAcquired: data.skills_acquired || null,
      offerLetterFile: data.offer_letter_file,
      offerLetterFilename: data.offer_letter_filename,
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
    logger.error({ err: err.message }, '[REGISTER_EXTERNAL_INTERNSHIP_ERROR]');
    return apiError(err.message, status);
  }
}
