import { wrapHandler, apiError, apiResponse } from '@/lib/api-utils';
import { LabBatchAllocationService } from '@/services/academic/LabBatchAllocationService';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';
import { z } from 'zod';

const previewSchema = z.object({
  academic_year: z.string().min(4),
  branch: z.string().min(1),
  semester: z.number().int().min(1).max(8),
  batch_1_range: z.string().optional().nullable(),
  batch_2_range: z.string().optional().nullable(),
  manual_overrides: z.record(z.union([z.number(), z.string()])).optional().default({})
});

export const POST = wrapHandler({
  auth: ['hod', 'faculty', 'admin'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);

    const json = await req.json();
    const parsed = previewSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message || 'Invalid parameters', 400);
    }

    const { academic_year, branch, semester, batch_1_range, batch_2_range, manual_overrides } = parsed.data;

    if (!isAcademicScopeAllowed(user, { branch, semester })) {
      return apiError('Forbidden: Outside authorized academic scope', 403);
    }

    try {
      const preview = await LabBatchAllocationService.previewBatchAllocation({
        academicYear: academic_year,
        branch,
        semester,
        batch1Range: batch_1_range || '',
        batch2Range: batch_2_range || '',
        manualOverrides: manual_overrides || {}
      });

      return apiResponse({ data: preview });
    } catch (err) {
      return apiError(err.message, 400);
    }
  }
});
