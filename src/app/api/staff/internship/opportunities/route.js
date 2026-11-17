import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipOpportunityService } from '@/services/internships/InternshipOpportunityService';
import logger from '@/lib/logger';
import { z } from 'zod';

const CreateOpportunitySchema = z.object({
  company_id: z.coerce.number().int().positive('Company is required'),
  title: z.string().trim().min(3, 'Title is required'),
  description: z.string().trim().min(10, 'Description is required'),
  category: z.string().trim().default('General Engineering'),
  required_skills: z.string().trim().optional().nullable(),
  required_qualifications: z.string().trim().optional().nullable(),
  eligible_branches: z.array(z.string()).min(1, 'At least one eligible branch is required'),
  eligible_academic_years: z.array(z.string()).min(1, 'At least one eligible academic year is required'),
  min_cgpa: z.coerce.number().min(0).max(10).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  duration: z.string().trim().optional().nullable(),
  mode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).default('HYBRID'),
  location: z.string().trim().optional().nullable(),
  stipend: z.string().trim().optional().nullable(),
  openings_count: z.coerce.number().int().min(1).default(1),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid deadline date is required'),
  additional_requirements: z.string().trim().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;
    const status = searchParams.get('status') || null;
    const branch = searchParams.get('branch') || null;
    const academicYear = searchParams.get('academicYear') || null;
    const search = searchParams.get('search') || '';
    const companyId = searchParams.get('companyId') || null;

    const result = await InternshipOpportunityService.getOpportunities({
      page,
      limit,
      status,
      branch,
      academicYear,
      search,
      companyId,
    });

    return apiResponse({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COORDINATOR_OPPORTUNITIES_ERROR]');
    return apiError(err.message, 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = CreateOpportunitySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const opp = await InternshipOpportunityService.createOpportunity({
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
      message: 'Internship opportunity created successfully',
      data: opp,
    }, 201);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[CREATE_OPPORTUNITY_ERROR]');
    return apiError(err.message, status);
  }
}
