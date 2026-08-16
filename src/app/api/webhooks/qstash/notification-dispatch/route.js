import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

async function handler(req) {
  try {
    const body = await req.json();
    const { recipients, notification } = body;

    logger.info({ count: recipients?.length, title: notification?.title }, '[QStashWorker] Processing Notification Dispatch');

    // Dynamically import PushNotificationService
    const { PushNotificationService } = await import('@/services/security/PushNotificationService');
    await PushNotificationService.sendToRecipients(recipients, notification);

    return NextResponse.json({ success: true, count: recipients?.length });
  } catch (error) {
    logger.error({ err: error }, '[QStashWorker] Notification Dispatch Failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY) ? verifySignatureAppRouter(handler) : handler;
