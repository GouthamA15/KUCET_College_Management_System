import { Client } from "@upstash/qstash";

// Initialize QStash Client
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || 'test_token',
});

// Generic enqueue method
export const enqueueJob = async (endpoint, payload, options = {}) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;

  if (!process.env.QSTASH_TOKEN) {
    console.warn('QSTASH_TOKEN not found, skipping background job. In production, this would fire to', url);
    return null;
  }

  return await qstashClient.publishJSON({
    url,
    body: payload,
    ...options
  });
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
