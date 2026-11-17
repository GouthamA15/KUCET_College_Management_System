import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipOpportunityService } from '@/services/internships/InternshipOpportunityService';
import logger from '@/lib/logger';
import { z } from 'zod';

const UpdateOpportunitySchema = z.object({
  company_id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().min(10).optional(),
  category: z.string().trim().optional(),
  required_skills: z.string().trim().optional().nullable(),
  required_qualifications: z.string().trim().optional().nullable(),
  eligible_branches: z.array(z.string()).optional(),
  eligible_academic_years: z.array(z.string()).optional(),
  min_cgpa: z.coerce.number().min(0).max(10).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  duration: z.string().trim().optional().nullable(),
  mode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  location: z.string().trim().optional().nullable(),
  stipend: z.string().trim().optional().nullable(),
  openings_count: z.coerce.number().int().min(1).optional(),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  additional_requirements: z.string().trim().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED']).optional(),
});

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id } = await params;
    const opp = await InternshipOpportunityService.getOpportunityById(id);
    if (!opp) {
      return apiError('Opportunity not found', 404);
    }

    return apiResponse({
      success: true,
      data: opp,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_OPPORTUNITY_DETAIL_ERROR]');
    return apiError(err.message, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id } = await params;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = UpdateOpportunitySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const opp = await InternshipOpportunityService.updateOpportunity(id, {
      companyId: data.company_id,
      title: data.title,
      description: data.description,
      category: data.category,
      requiredSkills: data.required_skills,
      requiredQualifications: data.required_qualifications,
      eligibleBranches: data.eligible_branches,
      eligibleAcademicYears: data.eligible_academic_years,
      minCgpa: data.min_cgpa,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration,
      mode: data.mode,
      location: data.location,
      stipend: data.stipend,
      openingsCount: data.openings_count,
      openingDate: data.opening_date,
      deadline: data.deadline,
      additionalRequirements: data.additional_requirements,
      status: data.status,
    }, staffId, { ip, userAgent });

    return apiResponse({
      success: true,
      message: 'Opportunity successfully updated',
      data: opp,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[UPDATE_OPPORTUNITY_ERROR]');
    return apiError(err.message, status);
  }
}

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const opp = await InternshipOpportunityService.setOpportunityStatus(id, status, staffId, { ip, userAgent });

    return apiResponse({
      success: true,
      message: `Opportunity status updated to ${status}`,
      data: opp,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[PATCH_OPPORTUNITY_STATUS_ERROR]');
    return apiError(err.message, status);
  }
}
