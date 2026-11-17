import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipCompanyService } from '@/services/internships/InternshipCompanyService';
import logger from '@/lib/logger';
import { z } from 'zod';

const CreateCompanySchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required'),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  industry: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  contact_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  contact_phone: z.string().trim().optional().nullable(),
  auto_verify: z.boolean().default(true),
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
    const search = searchParams.get('search') || '';

    const result = await InternshipCompanyService.getCompanies({
      page,
      limit,
      status,
      search,
    });

    return apiResponse({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COMPANIES_ERROR]');
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

    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const result = await InternshipCompanyService.createCompany({
      companyName: data.company_name,
      website: data.website || null,
      industry: data.industry || null,
      address: data.address || null,
      location: data.location || null,
      contactPerson: data.contact_person || null,
      contactEmail: data.contact_email || null,
      contactPhone: data.contact_phone || null,
      createdByUserType: 'STAFF',
      createdById: staffId,
      autoVerify: data.auto_verify,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: result.isExisting 
        ? 'Existing company record retrieved' 
        : 'Company successfully registered and verified',
      data: result.company,
    }, result.isExisting ? 200 : 201);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[CREATE_COMPANY_ERROR]');
    return apiError(err.message, status);
  }
}
