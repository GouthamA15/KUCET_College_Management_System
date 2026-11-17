import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipDocumentService } from '@/services/internships/InternshipDocumentService';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      // Empty body allowed
    }

    const branch = body.branch || 'ALL';
    const academicYear = body.academicYear || 'ALL';
    const status = body.status || 'ALL';

    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const { buffer, filename, fileCount, internshipCount } = await InternshipDocumentService.generateBulkDocumentZip({
      branch,
      academicYear,
      status,
      coordinatorStaffId: staffId,
      ip,
      userAgent,
    });

    logger.info({ staffId, branch, academicYear, fileCount, internshipCount }, '[BULK_INTERNSHIP_ZIP_DOWNLOADED]');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[BULK_DOWNLOAD_INTERNSHIPS_ERROR]');
    return apiError(err.message, status);
  }
}

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch') || 'ALL';
    const academicYear = searchParams.get('academicYear') || 'ALL';
    const status = searchParams.get('status') || 'ALL';

    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const { buffer, filename, fileCount, internshipCount } = await InternshipDocumentService.generateBulkDocumentZip({
      branch,
      academicYear,
      status,
      coordinatorStaffId: staffId,
      ip,
      userAgent,
    });

    logger.info({ staffId, branch, academicYear, fileCount, internshipCount }, '[BULK_INTERNSHIP_ZIP_DOWNLOADED_VIA_GET]');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[BULK_DOWNLOAD_INTERNSHIPS_GET_ERROR]');
    return apiError(err.message, status);
  }
}
