import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import { sendInstitutionalEmail } from '@/lib/email';
import logger from '@/lib/logger';

async function handler(req) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
    }

    const emailResult = await sendInstitutionalEmail({
      to,
      subject,
      bodyHtml: html
    });

    if (!emailResult.success) {
      logger.error('Failed to send queued email', emailResult.error);
      return NextResponse.json({ success: false, error: 'Provider failed' }, { status: 500 }); // 500 tells QStash to retry
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Email Webhook Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = process.env.QSTASH_TOKEN ? verifySignatureAppRouter(handler) : handler;
