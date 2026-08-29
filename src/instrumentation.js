import * as Sentry from "@sentry/nextjs";
import logger from '@/lib/logger';

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    
    if (!globalThis._warningListenerRegistered) {
      globalThis._warningListenerRegistered = true;
      process.on('warning', (warning) => {
        if (warning.name === 'MaxListenersExceededWarning') {
          console.error('[MEMORY LEAK TRACE]', warning.name, warning.message, warning.stack);
          logger.error({ name: warning.name, msg: warning.message, stack: warning.stack }, '[MEMORY LEAK TRACE]');
        }
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
