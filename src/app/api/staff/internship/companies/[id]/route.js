import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipCompanyService } from '@/services/internships/InternshipCompanyService';
import logger from '@/lib/logger';
import { z } from 'zod';

const UpdateCompanySchema = z.object({
  company_name: z.string().trim().min(2).optional(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  industry: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  contact_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  contact_phone: z.string().trim().optional().nullable(),
  status: z.enum(['VERIFIED', 'REJECTED', 'INACTIVE', 'PENDING_VERIFICATION']).optional(),
  rejection_reason: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id } = await params;
    const company = await InternshipCompanyService.getCompanyById(id);
    if (!company) {
      return apiError('Company not found', 404);
    }

    return apiResponse({
      success: true,
      data: company,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COMPANY_DETAIL_ERROR]');
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

    const parsed = UpdateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const data = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    let updatedCompany;

    // Status change action
    if (data.status && ['VERIFIED', 'REJECTED', 'INACTIVE'].includes(data.status)) {
      updatedCompany = await InternshipCompanyService.verifyCompany(id, {
        verifiedByStaffId: staffId,
        status: data.status,
        rejectionReason: data.rejection_reason || null,
        ip,
        userAgent,
      });
    }

    // Detail field updates
    updatedCompany = await InternshipCompanyService.updateCompany(id, {
      companyName: data.company_name,
      website: data.website,
      industry: data.industry,
      address: data.address,
      location: data.location,
      contactPerson: data.contact_person,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      isActive: data.is_active,
    }, {
      updatedBy: staffId,
      userType: 'STAFF',
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: 'Company successfully updated',
      data: updatedCompany,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[UPDATE_COMPANY_ERROR]');
    return apiError(err.message, status);
  }
}
