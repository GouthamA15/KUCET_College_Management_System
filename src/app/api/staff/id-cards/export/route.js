import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user }) => {
    // 1. RBAC Checks
    if (!IDCardAuthorizationService.canView(user)) {
      return apiError('Forbidden: You do not have permission to view ID card records', 403);
    }
    if (!IDCardAuthorizationService.canGenerate(user)) {
      return apiError('Forbidden: You do not have permission to export ID card data', 403);
    }

    // 2. Departmental / Branch Scoping
    const allowedBranches = IDCardAuthorizationService.getAllowedBranches(user);

    // 3. Extract Query Parameters
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const batch = searchParams.get('batch') || 'ALL';
    const format = searchParams.get('format') || 'xlsx';

    if (!branch) {
      return apiError('Academic branch parameter is required', 400);
    }

    // 4. Branch Permission Enforcement
    if (branch !== 'ALL' && !IDCardAuthorizationService.isBranchAllowed(user, branch)) {
      return apiError(`Forbidden: You do not have permission to access branch ${branch}`, 403);
    }

    try {
      // 5. Generate Complete Branch Export Dataset (Zero Pagination Truncation)
      const exportResult = await IDCardDataService.exportBranchData({
        branch,
        batch,
        format,
        allowedBranches,
        user,
      });

      logger.info({
        staffId: user.id || user.staffId,
        branch,
        batch,
        format,
        count: exportResult.count,
        filename: exportResult.filename,
      }, '[ID_CARD_BRANCH_EXPORT_SUCCESS]');

      const headers = new Headers();
      headers.set('Content-Type', exportResult.contentType);
      headers.set('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      headers.set('X-Total-Count', String(exportResult.count));

      return new NextResponse(exportResult.buffer, {
        status: 200,
        headers,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      if (statusCode === 404) {
        return apiError(err.message || 'No eligible students found for export', 404);
      }
      logger.error({ branch, err: err.message, stack: err.stack }, '[ID_CARD_BRANCH_EXPORT_FAILED]');
      return apiError(`Failed to export ID card dataset: ${err.message}`, statusCode);
    }
  },
});
