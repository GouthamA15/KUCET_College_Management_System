import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    const body = await req.json();
    const { studentId, certificateType, requestedBy } = body;

    logger.info({ studentId, certificateType, requestedBy }, '[QStashWorker] Processing PDF Generation Job');

    return NextResponse.json({
      success: true,
      jobId: `PDF-${Date.now()}`,
      certificateType,
      status: 'GENERATED'
    });
  } catch (error) {
    logger.error({ err: error }, '[QStashWorker] PDF Generation Failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
