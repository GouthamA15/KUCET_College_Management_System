import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;

async function handler(req) {
  try {
    const body = await req.json();
    const messageId = req.headers.get('upstash-message-id') || body.messageId || `dlq_${Date.now()}`;
    
    logger.error({ messageId, dlqBody: body }, 'QStash Dead Letter Queue (DLQ) Received Failed Task');

    if (redis) {
      const dlqRecord = {
        messageId,
        body,
        failedAt: new Date().toISOString(),
        status: 'FAILED_PERMANENTLY'
      };
      
      // Store failed job in Redis DLQ list and hash for inspection & manual replay
      await redis.lpush('dlq:failed_jobs', JSON.stringify(dlqRecord));
      await redis.set(`dlq_job:${messageId}`, JSON.stringify(dlqRecord), { ex: 2592000 }); // Retain 30 days
    }

    return NextResponse.json({ success: true, message: 'DLQ recorded successfully' });
  } catch (err) {
    logger.error('DLQ Webhook Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY) ? verifySignatureAppRouter(handler) : handler;
