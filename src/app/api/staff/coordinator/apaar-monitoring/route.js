import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { FirstYearApaarService } from '@/services/academic/FirstYearApaarService';

/**
 * GET /api/staff/coordinator/apaar-monitoring
 * 
 * First-Year Coordinator dedicated APAAR monitoring & export endpoint.
 * Provides real-time submission statistics, branch-wise filtering, search, pagination,
 * and secure formula-injection-protected Excel exports.
 * 
 * RBAC: First-Year Coordinators, Administrators, and Admission Staff.
 * Strictly prevents exposure of unrelated sensitive PII.
 */
export async function GET(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const userRole = (user.role || '').toLowerCase();
    const isSuperAdminOrPrincipal = ['admin', 'super_admin', 'principal'].includes(userRole);
    const isAdmissionStaff = ['admission', 'admission_clerk'].includes(userRole);
    const isCoordinator = Boolean(user.is_first_year_coordinator);

    if (!isSuperAdminOrPrincipal && !isAdmissionStaff && !isCoordinator) {
      return apiError('Forbidden: Access denied. Only First-Year Coordinators and administrators can access First-Year APAAR records.', 403);
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';
    const format = searchParams.get('format')?.toLowerCase()?.trim();
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;

    // Excel Export Request
    if (format === 'excel') {
      const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'First Year Workspace';

      const { fileBuffer, filename } = await FirstYearApaarService.generateExcelWorkbook({
        branch,
        status,
        staffUser: user,
        ipAddress,
        userAgent
      });

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        }
      });
    }

    // Default JSON Response for Dashboard
    const result = await FirstYearApaarService.getMonitoringData({
      branch,
      status,
      search,
      page,
      limit
    });

    return apiResponse({
      success: true,
      ...result,
      userRole,
      isCoordinator
    });

  } catch (error) {
    logger.error(error, 'Error in First-Year APAAR monitoring handler');
    return apiError('Failed to process APAAR monitoring request', 500, error.message);
  }
}
