import logger from '@/lib/logger';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';
import { bulkFinalizeAdmissionDrafts } from '@/services/admission/AdmissionDraftFinalizeService';

const itemSchema = z.object({
  draftId: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  roll_no: z.string().trim().toUpperCase().min(10).optional(),
  rollNo: z.string().trim().toUpperCase().min(10).optional(),
  admission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).optional()
}).refine(data => data.draftId !== undefined || data.id !== undefined, {
  message: 'Each item must have a draftId or id'
}).refine(data => !!(data.roll_no || data.rollNo), {
  message: 'Each item must have a roll_no'
});

const bulkSchema = z.object({
  items: z.array(itemSchema).min(1, 'At least one draft item is required for bulk finalization')
});

export const POST = wrapHandler({
  auth: 'admission',
  handler: async (req, { user }) => {
    if (user.role !== 'admission' && user.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    try {
      const json = await req.json();
      
      // Allow passing { items: [...] } or direct array [...] or { drafts: [...] }
      const rawItems = Array.isArray(json) 
        ? json 
        : (json.items || json.drafts || []);

      const validated = bulkSchema.parse({ items: rawItems });

      const normalizedItems = validated.items.map(item => ({
        draftId: item.draftId ?? item.id,
        roll_no: item.roll_no ?? item.rollNo,
        admission_date: item.admission_date ?? item.admissionDate ?? ''
      }));

      const result = await bulkFinalizeAdmissionDrafts({
        items: normalizedItems,
        user
      });

      return apiResponse(result, result.successful > 0 ? 200 : 400);

    } catch (error) {
      if (error instanceof z.ZodError || error?.name === 'ZodError') {
        const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid input data';
        return apiError(msg, 400);
      }
      logger.error(error, 'Bulk finalization error');
      throw error;
    }
  },
  audit: {
    action: 'BULK_FINALIZE_ADMISSION',
    getTargetId: (_data, result) => result?.results?.[0]?.studentId || 'BULK',
    getAfter: (_data, result) => ({ 
      total: result?.total, 
      successful: result?.successful, 
      failed: result?.failed 
    })
  }
});
