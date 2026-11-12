import { NextResponse } from 'next/server';
import { wrapHandler, apiError } from '@/lib/api-utils';
import { BulkImportTemplateService } from '@/services/admission/BulkImportTemplateService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (_req, { user }) => {
    try {
      const buffer = await BulkImportTemplateService.generateTemplateBuffer();

      const filename = 'KUCET_Student_Bulk_Import_Template.xlsx';
      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

      logger.info({
        staffId: user?.id || user?.staffId,
        filename,
      }, '[BULK_IMPORT_TEMPLATE_DOWNLOADED]');

      return new NextResponse(buffer, {
        status: 200,
        headers,
      });
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, '[BULK_IMPORT_TEMPLATE_ERROR]');
      return apiError('Failed to generate student bulk import Excel template', 500);
    }
  },
});
