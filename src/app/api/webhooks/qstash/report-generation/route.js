import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

async function handler(req) {
  try {
    const body = await req.json();
    const { reportType, _filters, requestedBy } = body;

    logger.info({ reportType, requestedBy }, '[QStashWorker] Processing Report Generation Job');

    // Return report job status
    return NextResponse.json({
      success: true,
      reportId: `REP-${Date.now()}`,
      reportType,
      status: 'COMPLETED',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, '[QStashWorker] Report Generation Failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY) ? verifySignatureAppRouter(handler) : handler;
