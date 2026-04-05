import { z } from 'zod';
import logger from './logger.js';

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.string().transform((v) => parseInt(v, 10)).default('3306'),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_DATABASE: z.string().min(1, "DB_DATABASE is required"),
  DB_SSL: z.enum(['true', 'false']).default('false'),

  // Email
  EMAIL_USER: z.string().email("EMAIL_USER must be a valid email"),
  BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required"),

  // Secrets for JWT and Certificate
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters for security"),
  CERTIFICATE_SECRET: z.string().min(1, "CERTIFICATE_SECRET is required"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be a 64-character hex string"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

  // Supabase (Real-time Messaging)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

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
  try {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      const { fieldErrors } = parsed.error.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `  - ${field}: ${errors.join(', ')}`)
        .join('\n');

      console.error('\n❌ INVALID ENVIRONMENT VARIABLES:\n' + errorMessage + '\n');
      
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
