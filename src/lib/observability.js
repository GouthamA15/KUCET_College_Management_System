import logger from '@/lib/logger';
import crypto from 'crypto';

/**
 * Generates a unique error correlation ID for tracking issues in logs
 */
export function createErrorCorrelationId() {
  return `ERR-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Formats a standardized JSON error response with correlation ID
 */
export function formatErrorResponse(message, statusCode = 500, details = null) {
  const correlationId = createErrorCorrelationId();
  logger.error({ correlationId, statusCode, details, message }, '[API Error]');
  return {
    error: message,
    statusCode,
    correlationId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wraps async database queries or heavy computations to log slow queries
 */
export async function logSlowQuery(queryName, fetcher, thresholdMs = 200) {
  const start = Date.now();
  try {
    const result = await fetcher();
    const duration = Date.now() - start;
    if (duration > thresholdMs) {
      logger.warn({ queryName, durationMs: duration, thresholdMs }, '[SlowQueryDetected]');
    }
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ queryName, durationMs: duration, err }, '[QueryFailed]');
    throw err;
  }
}

/**
 * Tracing wrapper for API route handlers to measure latency and attach request metadata
 */
export async function withPerformanceTracing(handlerName, handlerFn) {
  const start = Date.now();
  try {
    const res = await handlerFn();
    const duration = Date.now() - start;
    logger.info({ handlerName, durationMs: duration }, '[PerformanceTracing]');
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ handlerName, durationMs: duration, err }, '[PerformanceTracingError]');
    throw err;
  }
}

/**
 * Sentry integration fallback wrapper
 */
export function captureException(error, context = {}) {
  logger.error({ err: error, context }, '[SentryCaptureException]');
  if (typeof globalThis.Sentry !== 'undefined' && globalThis.Sentry.captureException) {
    globalThis.Sentry.captureException(error, { extra: context });
  }
}
