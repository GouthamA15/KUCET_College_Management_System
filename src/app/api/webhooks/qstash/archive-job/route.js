import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { ArchiveService } from '@/services/archive/ArchiveService';

export async function POST(req) {
  try {
    const body = await req.json();
    const { archiveType, targetParams } = body;

    logger.info({ archiveType, targetParams }, '[QStashWorker] Processing Archive Job');

    if (archiveType === 'semester') {
      const result = await ArchiveService.runSemesterArchive(targetParams.branch, targetParams.semester);
      return NextResponse.json({ success: true, result });
    } else if (archiveType === 'alumni') {
      const result = await ArchiveService.runAlumniArchive(targetParams.batchYear, targetParams.branch);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ success: false, error: 'Invalid archive type' }, { status: 400 });
  } catch (error) {
    logger.error({ err: error }, '[QStashWorker] Archive Job Failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
