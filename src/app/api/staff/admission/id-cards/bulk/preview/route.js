import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { BulkIdCardService } from '@/services/admission/id-card/BulkIdCardService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user }) => {
    try {
      const url = new URL(req.url);
      const branch = url.searchParams.get('branch') || 'ALL';
      const academicLevel = url.searchParams.get('academicLevel') || 'FIRST_YEAR';
      const academicYear = url.searchParams.get('academicYear') || null;

      const preview = await BulkIdCardService.getBulkPreview({
        user,
        branch,
        academicLevel,
        academicYear,
      });

      return apiResponse(preview);
    } catch (err) {
      const statusCode = err.statusCode || 500;
      logger.error({ err: err.message, stack: err.stack }, 'Bulk ID Card Preview generation failed');
      return apiError(err.message || 'Failed to generate bulk ID card preview', statusCode);
    }
  },
});
