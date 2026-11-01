import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    const user = (await getAuthUser('faculty')) || (await getAuthUser('admin'));
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'combined'; // 'attendance', 'marks', 'combined'
    const branch = searchParams.get('branch');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academic_year') || searchParams.get('year');

    const csvContent = await AcademicMonitoringService.generateCsvExport({
      user,
      type,
      branch,
      semester,
      academicYear
    });

    const filename = `KUCET_Academic_Monitoring_${branch || 'ALL'}_Sem${semester || '1'}_${type.toUpperCase()}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) {
      logger.error({ err, url: request.url }, '[ACADEMIC_MONITORING_CSV_ERR]');
    }
    return apiError(err.message || 'Failed to generate CSV export', status);
  }
}
