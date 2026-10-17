import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { AdmissionFinalizationService, FINALIZATION_STATUS } from '@/services/AdmissionFinalizationService';
import { z } from 'zod';

const updateStatusSchema = z.object({
  branch: z.string().trim().toUpperCase().min(2).max(50),
  status: z.enum([
    FINALIZATION_STATUS.NOT_STARTED,
    FINALIZATION_STATUS.IN_PROGRESS,
    FINALIZATION_STATUS.FINALIZED,
  ]),
  admissionYear: z.number().int().min(2000).max(2100).optional(),
});

/**
 * GET /api/staff/admission/branch-status
 * Retrieve branch finalization status across all branches or for a specific branch.
 * Protected: Admission staff or Super Admin only.
 */
export async function GET(req) {
  const user = await getAuthUser('staff');
  if (!user || (user.role !== 'admission' && user.role !== 'admin')) {
    return apiError('Forbidden: Only admission staff or administrators can access branch status', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const yearParam = searchParams.get('year') || searchParams.get('admissionYear');
    const admissionYear = yearParam ? parseInt(yearParam, 10) : null;

    if (branch) {
      const status = await AdmissionFinalizationService.getBranchFinalizationStatus({
        branch,
        admissionYear,
      });
      return apiResponse({ success: true, ...status });
    }

    const allStatuses = await AdmissionFinalizationService.getAllBranchStatuses(admissionYear);
    return apiResponse({ success: true, ...allStatuses });
  } catch (error) {
    return apiError(error.message || 'Failed to fetch branch admission status', 500);
  }
}

/**
 * PUT /api/staff/admission/branch-status
 * Explicitly update or override the branch finalization status.
 * Protected: Admission staff or Super Admin only.
 */
export async function PUT(req) {
  const user = await getAuthUser('staff');
  if (!user || (user.role !== 'admission' && user.role !== 'admin')) {
    return apiError('Forbidden: Only admission staff or administrators can update branch status', 403);
  }

  try {
    const json = await req.json();
    const parseResult = updateStatusSchema.safeParse(json);
    if (!parseResult.success) {
      return apiError(parseResult.error.errors?.[0]?.message || 'Invalid input data', 400);
    }

    const { branch, status, admissionYear } = parseResult.data;
    const actor = user.email || `staff-${user.id || user.staffId}`;

    const result = await AdmissionFinalizationService.setBranchStatus({
      branch,
      admissionYear,
      status,
      updatedBy: actor,
    });

    return apiResponse({ success: true, ...result });
  } catch (error) {
    return apiError(error.message || 'Failed to update branch admission status', 500);
  }
}
