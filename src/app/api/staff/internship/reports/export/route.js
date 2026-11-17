import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipReportingService } from '@/services/internships/InternshipReportingService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xlsx';
    const reportType = searchParams.get('reportType') || 'branch';
    const branch = searchParams.get('branch') || 'ALL';
    const academicYear = searchParams.get('academicYear') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const studentSearch = searchParams.get('studentSearch') || '';

    const staffId = user.id || user.staffId;

    if (format === 'csv') {
      const csvData = await InternshipReportingService.generateReportCsv({
        reportType,
        branch,
        academicYear,
        studentSearch,
      });

      const filename = `KUCET_Internship_Report_${reportType}_${Date.now()}.csv`;
      logger.info({ staffId, branch, academicYear, reportType }, '[INTERNSHIP_CSV_REPORT_EXPORTED]');

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const buffer = await InternshipReportingService.exportInternshipExcel({
      branch,
      academicYear,
      status,
    });

    const filename = `KUCET_Internships_Summary_${branch}_${academicYear}_${Date.now()}.xlsx`;
    logger.info({ staffId, branch, academicYear }, '[INTERNSHIP_EXCEL_REPORT_EXPORTED]');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[EXPORT_INTERNSHIP_EXCEL_ERROR]');
    return apiError(err.message, 500);
  }
}
