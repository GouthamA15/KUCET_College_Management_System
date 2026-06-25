import { Client } from "@upstash/qstash";
import { getBreaker } from '@/lib/utils/CircuitBreaker';
import logger from '@/lib/logger';

// Initialize QStash Client
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || 'test_token',
});

const qstashBreaker = getBreaker('QStash');

// Generic enqueue method
export const enqueueJob = async (endpoint, payload, options = {}) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;

  if (!process.env.QSTASH_TOKEN) {
    console.warn('QSTASH_TOKEN not found, skipping background job. In production, this would fire to', url);
    return null; // Keep null for not configured state to match existing logic
  }

  try {
    const result = await qstashBreaker.execute(async () => {
      return await qstashClient.publishJSON({
        url,
        body: payload,
        ...options
      });
    });
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, url }, 'Failed to enqueue QStash job');
    return { success: false, error: error.message };
  }
};

export const Queue = {
  // 1. Bulk Import Queue
  enqueueBulkImportChunk: async (chunk, clerkId, importFileName) => {
    return await enqueueJob('/api/webhooks/qstash/bulk-import', {
      chunk,
      clerkId,
      importFileName
    });
  },

  // 2. Email Dispatch Queue
  enqueueEmail: async (to, subject, html) => {
    return await enqueueJob('/api/webhooks/qstash/send-email', {
      to,
      subject,
      html
    });
  },

  // 3. PDF Generation Queue
  enqueuePdfGeneration: async (studentId, certificateType, requestedBy) => {
    return await enqueueJob('/api/webhooks/qstash/generate-pdf', {
      studentId,
      certificateType,
      requestedBy
    });
  }
};
