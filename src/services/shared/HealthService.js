import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { Redis } from '@upstash/redis';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';

export class HealthService {
  static async checkDatabase() {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      return { status: 'ok', latencyMs: Date.now() - start, error: null };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Database connection failed');
      return { status: 'error', latencyMs: -1, error: error.message };
    }
  }

  static async checkRedis() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return { status: 'not_configured', latencyMs: 0, error: null };
    }

    try {
      const start = Date.now();
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const ping = await redis.ping();
      const latencyMs = Date.now() - start;
      const status = ping === 'PONG' ? 'ok' : 'degraded';
      return { status, latencyMs, error: status === 'ok' ? null : 'Unexpected ping response' };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Redis connection failed');
      return { status: 'error', latencyMs: -1, error: error.message };
    }
  }

  static checkEmailConfig() {
    try {
      if (process.env.BREVO_API_KEY && process.env.EMAIL_USER) {
        return { status: 'configured', provider: 'Brevo/SMTP', error: null };
      }
      return { status: 'missing_credentials', provider: 'unconfigured', error: 'Email credentials not configured' };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Email configuration check failed');
      return { status: 'error', error: error.message };
    }
  }

  static async checkStorage() {
    try {
      const start = Date.now();
      const storage = getStorageProvider();
      const isAvailable = !!storage;
      return { status: isAvailable ? 'ok' : 'error', latencyMs: Date.now() - start, type: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary' };
    } catch (error) {
      return { status: 'error', latencyMs: -1, error: error.message };
    }
  }

  static checkPushNotifications() {
    return { status: 'ok', mode: 'VAPID/WebPush' };
  }

  static checkQueue() {
    const configured = !!process.env.QSTASH_TOKEN;
    return { status: configured ? 'ok' : 'degraded', provider: 'Upstash QStash' };
  }

  static checkBackups() {
    return { status: 'ok', defaultSchedule: '0 2 * * *', retentionDays: 30 };
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
        logger.warn({ status: s }, 'Unknown health status');
      }
      return severity || 0;
    }));

    if (maxSeverity >= 3) return 'unhealthy';
    if (maxSeverity >= 2) return 'degraded';
    return 'healthy';
  }

  /**
   * Determine if an error should be considered critical
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

  static async getFullDiagnostics() {
    const [dbRes, redisRes, storageRes] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const emailRes = this.checkEmailConfig();
    const pushRes = this.checkPushNotifications();
    const queueRes = this.checkQueue();
    const backupRes = this.checkBackups();

    const overall = this.determineStatus(dbRes.status, redisRes.status, emailRes.status);

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsageMb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      components: {
        database: dbRes,
        redis: redisRes,
        storage: storageRes,
        email: emailRes,
        pushNotifications: pushRes,
        queue: queueRes,
        backups: backupRes,
      },
    };
  }
}

export default HealthService;
