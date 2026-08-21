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
  const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (!process.env.QSTASH_TOKEN) {
    logger.warn({ url }, 'QSTASH_TOKEN not found, skipping background job dispatch');
    return null;
  }

  const dlqUrl = `${baseUrl}/api/webhooks/qstash/dlq`;

  try {
    const result = await qstashBreaker.execute(async () => {
      return await qstashClient.publishJSON({
        url,
        body: payload,
        failureCallback: dlqUrl,
        retries: 3,
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
  enqueueBulkImportChunk: async (chunk, staffId, importFileName) => {
    return await enqueueJob('/api/webhooks/qstash/bulk-import', {
      chunk,
      staffId,
      importFileName
    });
  },

  // 2. Email Dispatch Queue
  enqueueEmail: async (to, subject, html, title, infoRows) => {
    return await enqueueJob('/api/webhooks/qstash/send-email', {
      to,
      subject,
      html,
      title,
      infoRows
    });
  },

  // 3. PDF Generation Queue
  enqueuePdfGeneration: async (studentId, certificateType, requestedBy) => {
    return await enqueueJob('/api/webhooks/qstash/generate-pdf', {
      studentId,
      certificateType,
      requestedBy
    });
  },

  // 4. Archive Job Queue
  enqueueArchiveJob: async (archiveType, targetParams) => {
    return await enqueueJob('/api/webhooks/qstash/archive-job', {
      archiveType,
      targetParams
    });
  },

  // 5. Notification Dispatch Queue
  enqueueNotificationDispatch: async (recipients, notification) => {
    return await enqueueJob('/api/webhooks/qstash/notification-dispatch', {
      recipients,
      notification
    });
  },

  // 6. Report Generation Queue
  enqueueReportGeneration: async (reportType, filters, requestedBy) => {
    return await enqueueJob('/api/webhooks/qstash/report-generation', {
      reportType,
      filters,
      requestedBy
    });
  }
};
