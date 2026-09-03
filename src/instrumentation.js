import * as Sentry from "@sentry/nextjs";
import { EventEmitter } from 'events';
import logger from '@/lib/logger';

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Increase default max listeners for Next.js internal event emitter streams
    EventEmitter.defaultMaxListeners = 25;

    await import("../sentry.server.config");
    
    if (!globalThis._warningListenerRegistered) {
      globalThis._warningListenerRegistered = true;
      process.on('warning', (warning) => {
        if (warning.name === 'MaxListenersExceededWarning') {
          logger.warn({ name: warning.name, msg: warning.message }, '[PROCESS_WARNING]');
        }
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
