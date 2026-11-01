import fs from 'fs';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { BulkIdCardService } from '@/services/admission/id-card/BulkIdCardService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user, context }) => {
    try {
      const { jobId } = (await context?.params) || {};

      if (!jobId) {
        return apiError('Job ID is required for download', 400);
      }

      const job = BulkIdCardService.getJob(jobId, user);

      if (!job) {
        return apiError('Download link is invalid, expired, or has already been consumed', 404);
      }

      if (!fs.existsSync(job.filePath)) {
        BulkIdCardService.cleanupJob(jobId);
        return apiError('Archive package file not found on server', 410);
      }

      const nodeStream = fs.createReadStream(job.filePath);
      const webStream = Readable.toWeb(nodeStream);

      const headers = new Headers();
      headers.set('Content-Type', 'application/zip');
      headers.set('Content-Disposition', `attachment; filename="${job.zipFilename}"`);
      headers.set('Content-Length', String(job.fileSize));
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      headers.set('X-Total-Students', String(job.totalEligible));
      headers.set('X-Generated-Cards', String(job.generatedCount));

      // Schedule cleanup of the temporary file shortly after the download completes
      setTimeout(() => {
        BulkIdCardService.cleanupJob(jobId);
      }, 30000);

      logger.info({ jobId, user: user.id, filename: job.zipFilename }, 'Bulk ID card ZIP download dispatched');

      return new NextResponse(webStream, { status: 200, headers });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      logger.error({ err: err.message, stack: err.stack }, 'Bulk ID Card ZIP download stream failed');
      return apiError(err.message || 'Failed to download bulk ID cards archive', statusCode);
    }
  },
});
