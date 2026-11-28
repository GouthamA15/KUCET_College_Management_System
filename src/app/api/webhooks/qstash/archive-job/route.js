import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { ArchiveService } from '@/services/archive/ArchiveService';

async function handler(req) {
  try {
    const body = await req.json();
    const { archiveType, targetParams } = body;

    logger.info({ archiveType, targetParams }, '[QStashWorker] Processing Archive Job');

    if (archiveType === 'semester') {
      const result = await ArchiveService.runSemesterArchive({
        branch: targetParams?.branch,
        semester: targetParams?.semester,
        academic_year: targetParams?.academic_year || targetParams?.academicYear,
        archived_by: targetParams?.archived_by || 'QSTASH_WORKER',
      });
      return NextResponse.json({ success: true, result });
    } else if (archiveType === 'alumni') {
      const result = await ArchiveService.runAlumniArchive({
        graduation_year: targetParams?.batchYear || targetParams?.graduation_year,
        branch: targetParams?.branch,
        student_ids: targetParams?.student_ids || [],
        archived_by: targetParams?.archived_by || 'QSTASH_WORKER',
      });
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ success: false, error: 'Invalid archive type' }, { status: 400 });
  } catch (error) {
    logger.error({ err: error }, '[QStashWorker] Archive Job Failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY) ? verifySignatureAppRouter(handler) : handler;
