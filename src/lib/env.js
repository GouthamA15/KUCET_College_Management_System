import { z } from 'zod';
import logger from './logger.js';

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'testing', 'production']).default('production'),

  // Database
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.string().transform((v) => parseInt(v, 10)).default('3306'),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_DATABASE: z.string().min(1, "DB_DATABASE is required"),
  DB_SSL: z.enum(['true', 'false']).default('false'),

  // Email (Categorized Brevo API Keys & Sender Identities)
  EMAIL_USER: z.string().email("EMAIL_USER must be a valid email").optional(),
  BREVO_API_KEY: z.string().optional(),

  // Category A - Authentication OTP
  BREVO_API_KEY_AUTH_OTP: z.string().optional(),
  BREVO_SENDER_EMAIL_AUTH_OTP: z.string().email().optional(),
  BREVO_SENDER_NAME_AUTH_OTP: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_AUTH_OTP: z.string().email().optional(),

  // Category B - Password Recovery
  BREVO_API_KEY_PASSWORD_RECOVERY: z.string().optional(),
  BREVO_SENDER_EMAIL_PASSWORD_RECOVERY: z.string().email().optional(),
  BREVO_SENDER_NAME_PASSWORD_RECOVERY: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_PASSWORD_RECOVERY: z.string().email().optional(),

  // Category C - Security Alerts
  BREVO_API_KEY_SECURITY_ALERTS: z.string().optional(),
  BREVO_SENDER_EMAIL_SECURITY_ALERTS: z.string().email().optional(),
  BREVO_SENDER_NAME_SECURITY_ALERTS: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_SECURITY_ALERTS: z.string().email().optional(),

  // Category D - Staff Onboarding
  BREVO_API_KEY_STAFF_ONBOARDING: z.string().optional(),
  BREVO_SENDER_EMAIL_STAFF_ONBOARDING: z.string().email().optional(),
  BREVO_SENDER_NAME_STAFF_ONBOARDING: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_STAFF_ONBOARDING: z.string().email().optional(),

  // Category E - Admissions
  BREVO_API_KEY_ADMISSIONS: z.string().optional(),
  BREVO_SENDER_EMAIL_ADMISSIONS: z.string().email().optional(),
  BREVO_SENDER_NAME_ADMISSIONS: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_ADMISSIONS: z.string().email().optional(),

  // Category F - Scholarship
  BREVO_API_KEY_SCHOLARSHIP: z.string().optional(),
  BREVO_SENDER_EMAIL_SCHOLARSHIP: z.string().email().optional(),
  BREVO_SENDER_NAME_SCHOLARSHIP: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_SCHOLARSHIP: z.string().email().optional(),

  // Category G - System Operations
  BREVO_API_KEY_SYSTEM_OPERATIONS: z.string().optional(),
  BREVO_SENDER_EMAIL_SYSTEM_OPERATIONS: z.string().email().optional(),
  BREVO_SENDER_NAME_SYSTEM_OPERATIONS: z.string().optional(),
  BREVO_REPLY_TO_EMAIL_SYSTEM_OPERATIONS: z.string().email().optional(),

  ENABLE_LEGACY_BREVO_KEY_FALLBACK: z.enum(['true', 'false']).default('false'),

  // Secrets for JWT and Certificate
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters for security"),
  CERTIFICATE_SECRET: z.string().min(1, "CERTIFICATE_SECRET is required"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be a 64-character hex string"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Supabase (Real-time Messaging - Optional for VPS)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Real-time Provider Configuration (socketio | redis | supabase | hybrid)
  REALTIME_PROVIDER: z.enum(['socketio', 'redis', 'supabase', 'hybrid']).default('socketio').optional(),
  NEXT_PUBLIC_REALTIME_PROVIDER: z.enum(['socketio', 'redis', 'supabase', 'hybrid']).optional(),

  // VPS Real-time (Socket.io)
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),

  // Storage (Cloudinary | Local VPS | S3)
  STORAGE_PROVIDER: z.enum(['cloudinary', 'local', 's3', 'r2']).optional(),
  STORAGE_TYPE: z.enum(['cloudinary', 'local', 's3', 'r2']).optional(),
  NEXT_PUBLIC_STORAGE_PROVIDER: z.enum(['cloudinary', 'local', 's3', 'r2']).optional(),
  NEXT_PUBLIC_STORAGE_TYPE: z.enum(['cloudinary', 'local', 's3', 'r2']).default('local'),
  LOCAL_STORAGE_PATH: z.string().optional(),

  // Public URLs
  NEXT_PUBLIC_BASE_URL: z.string().url("NEXT_PUBLIC_BASE_URL must be a valid URL"),

  // Optional / Distributed
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

/**
 * Validates environment variables at startup.
 * Throws an informative error if any required variables are missing or invalid.
 */
export function validateEnv() {
  // Allow GitHub Actions and CI environments to bypass strict validation during static builds
  if (process.env.CI === 'true' || process.env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }
  
  try {
    const envData = { ...process.env };
    // Force NODE_ENV to lowercase and trim to handle potential OS/Environment inconsistencies
    if (envData.NODE_ENV) {
      envData.NODE_ENV = envData.NODE_ENV.toLowerCase().trim();
    }

    const parsed = envSchema.safeParse(envData);

    if (!parsed.success) {
      const { fieldErrors } = parsed.error.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `  - ${field}: ${errors.join(', ')}`)
        .join('\n');

      console.error('\n❌ INVALID ENVIRONMENT VARIABLES:\n' + errorMessage);
      console.error(`Received NODE_ENV: "${process.env.NODE_ENV}"\n`);
      
      // In production, we want to hard crash if env is invalid.
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Invalid environment variables. Fix the issues listed above to start the server.');
      } else {
        logger.warn('Environment validation failed. Some features may not work correctly.');
      }
    } else {
      logger.info('✅ Environment variables validated successfully.');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}

// Auto-validate on import if we are on the server side
if (typeof window === 'undefined') {
  validateEnv();
}

export const env = process.env;
