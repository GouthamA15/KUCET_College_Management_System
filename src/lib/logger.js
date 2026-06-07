import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

const isProduction = process.env.NODE_ENV === 'production';
const storage = new AsyncLocalStorage();

// In production, we log JSON to standard output.
// In development, we use pino-pretty for readable logs.
const transport = !isProduction
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

const pinoLogger = pino({
  level: isProduction ? 'info' : 'debug',
  base: isProduction ? { env: 'production' } : undefined,
  transport,
  // Mix in request context from AsyncLocalStorage if available
  mixin() {
    const context = storage.getStore();
    return context || {};
  },
  redact: {
    paths: [
      'email',
      'password',
      'hashedPassword',
      '*.email',
      '*.password',
      '*.hashedPassword',
      'mobile',
      'aadhaar_no',
      '*.aadhaar_no',
      'student_mobile',
      'guardian_mobile'
    ],
    censor: '[REDACTED]',
  },
});

const logger = {
  info: (obj, msg) => pinoLogger.info(obj, msg),
  warn: (obj, msg) => pinoLogger.warn(obj, msg),
  error: (obj, msg) => pinoLogger.error(obj, msg),
  debug: (obj, msg) => pinoLogger.debug(obj, msg),
  
  /**
   * Runs a function within a logging context (e.g., with a traceId)
   */
  runWithContext: (context, fn) => storage.run(context, fn),
};

export default logger;
