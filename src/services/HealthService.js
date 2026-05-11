import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

/**
 * HealthService - Encapsulates health check business logic
 * Provides methods to check database, Redis, and email configuration
 */
export class HealthService {
  static async checkDatabase() {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ok', error: null };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Database connection failed');
      return { status: 'error', error: error.message };
    }
  }

  static async checkRedis() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return { status: 'not_configured', error: null };
    }

    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const ping = await redis.ping();
      const status = ping === 'PONG' ? 'ok' : 'degraded';
      return { status, error: status === 'ok' ? null : 'Unexpected ping response' };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Redis connection failed');
      return { status: 'error', error: error.message };
    }
  }

  static checkEmailConfig() {
    try {
      if (process.env.BREVO_API_KEY && process.env.EMAIL_USER) {
        return { status: 'configured', error: null };
      }
      return { status: 'missing_credentials', error: 'Email credentials not configured' };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Email configuration check failed');
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Determine overall system status based on component statuses
   * Uses severity ordering: unhealthy > degraded > ok
   */
  static determineStatus(dbStatus, redisStatus, emailStatus) {
    const severityMap = {
      error: 3,
      unhealthy: 3,
      degraded: 2,
      missing_credentials: 2,
      ok: 1,
      configured: 1,
      not_configured: 1,
    };

    const statuses = [dbStatus, redisStatus, emailStatus];
    const maxSeverity = Math.max(...statuses.map(s => {
      const severity = severityMap[s];
      if (severity === undefined) {
        console.warn(`Unknown health status: ${s}`);
      }
      return severity || 0;
    }));

    if (maxSeverity >= 3) return 'unhealthy';
    if (maxSeverity >= 2) return 'degraded';
    return 'healthy';
  }

  /**
   * Determine if an error should be considered critical
   * Critical errors are those that require 503 response
   */
  static isCriticalError(dbStatus, emailStatus) {
    const severityMap = {
      error: 3,
      unhealthy: 3,
      degraded: 2,
      missing_credentials: 2,
      ok: 1,
      configured: 1,
      not_configured: 1,
    };

    const dbSeverity = severityMap[dbStatus] || 0;
    const emailSeverity = severityMap[emailStatus] || 0;
    
    return Math.max(dbSeverity, emailSeverity) >= 3;
  }
}
