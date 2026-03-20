import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

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

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: isProduction ? { env: 'production' } : undefined,
  transport,
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

export default logger;
