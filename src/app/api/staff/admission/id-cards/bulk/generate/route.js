import { z } from 'zod';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { BulkIdCardService } from '@/services/admission/id-card/BulkIdCardService';
import logger from '@/lib/logger';

const generateSchema = z.object({
  branch: z.string().trim().default('ALL'),
  academicLevel: z.string().trim().default('FIRST_YEAR'),
  academicYear: z.string().trim().optional(),
});

export const POST = wrapHandler({
  auth: ['staff', 'admin'],
  schema: generateSchema,
  handler: async (req, { data, user }) => {
    try {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'System';

      const result = await BulkIdCardService.generateBulkZip({
        user,
        branch: data.branch,
        academicLevel: data.academicLevel,
        academicYear: data.academicYear,
        ip: clientIp,
        userAgent,
      });

      return apiResponse(result, 201);
    } catch (err) {
      const statusCode = err.statusCode || 500;
      logger.error({ err: err.message, stack: err.stack }, 'Bulk ID Card ZIP generation failed');
      return apiError(err.message || 'Failed to generate bulk ID cards package', statusCode);
    }
  },
});
