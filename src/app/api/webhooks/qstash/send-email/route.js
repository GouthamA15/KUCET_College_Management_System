import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import { sendInstitutionalEmail } from '@/lib/email';
import logger from '@/lib/logger';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;

async function handler(req) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
    }

    const messageId = req.headers.get('upstash-message-id') || body.job_id;
    if (messageId && redis) {
      try {
        const isSent = await redis.get(`email_job:${messageId}`);
        if (isSent === 'sent') {
          logger.info(`Skipping duplicate email job: ${messageId}`);
          return NextResponse.json({ success: true, message: 'Already sent' });
        }
      } catch (redisReadError) {
        logger.warn('Failed to read from Redis, proceeding with email send', redisReadError);
      }
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

    if (messageId && redis) {
      try {
        await redis.set(`email_job:${messageId}`, 'sent', { ex: 604800 }); // Expire in 7 days
      } catch (redisError) {
        logger.error('Failed to persist idempotency marker in Redis', redisError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Email Webhook Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = process.env.QSTASH_TOKEN ? verifySignatureAppRouter(handler) : handler;
