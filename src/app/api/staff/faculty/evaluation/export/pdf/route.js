import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { EvaluationReportService } from '@/services/academic/EvaluationReportService';
import logger from '@/lib/logger';
import { z } from 'zod';

const querySchema = z.object({
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive({ message: 'Valid assignment ID required' })),
  view: z.string().optional().default('overview')
});

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse({
      assignment_id: searchParams.get('assignment_id') || searchParams.get('id'),
      view: searchParams.get('view') || 'overview'
    });

    if (!parseResult.success) {
      return apiError(parseResult.error.errors?.[0]?.message || 'Invalid parameters', 400);
    }

    const { assignment_id, view } = parseResult.data;

    // Fetch report data authoritatively
    const reportData = await EvaluationReportService.getReportData({
      assignmentId: assignment_id,
      view,
      user,
      request
    });

    // Generate PDF Buffer
    const pdfBuffer = await EvaluationReportService.generatePdfBuffer(reportData);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${reportData.filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const requestId = request.headers.get('x-request-id') || request.headers.get('x-correlation-id') || null;

    if (status >= 500) {
      logger.error({ err, requestId, url: request.url }, 'Evaluation Export PDF Error');
      return apiError('Failed to generate evaluation PDF export', 500);
    }

    logger.warn({ msg: err.message, status, requestId, url: request.url }, 'Evaluation Export PDF Request Rejected');
    return apiError(err.message, status);
  }
}
