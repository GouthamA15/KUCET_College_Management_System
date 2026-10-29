import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { Redis } from '@upstash/redis';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';

const TIMEOUT_MS = 3000;

function withTimeout(promise, ms, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} check timed out after ${ms}ms`)), ms)
    ),
  ]);
}

let healthRedisClient = null;
let healthRedisUrl = null;

export class HealthService {
  static resetRedisClient() {
    if (healthRedisClient) {
      try { healthRedisClient.disconnect(); } catch { /* ignore */ }
      healthRedisClient = null;
      healthRedisUrl = null;
    }
  }

  static async checkDatabase() {
    try {
      const start = Date.now();
      await withTimeout(db.execute(sql`SELECT 1`), TIMEOUT_MS, 'Database');
      return { status: 'ok', latencyMs: Date.now() - start, error: null };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Database connection failed');
      return { status: 'error', latencyMs: -1, error: error.message };
    }
  }

  static async checkRedis() {
    if (process.env.REDIS_URL) {
      try {
        const start = Date.now();
        const { default: IORedis } = await import('ioredis');

        if (!healthRedisClient || healthRedisUrl !== process.env.REDIS_URL) {
          if (healthRedisClient) {
            try { healthRedisClient.disconnect(); } catch { /* ignore */ }
          }
          healthRedisUrl = process.env.REDIS_URL;
          healthRedisClient = new IORedis(healthRedisUrl, {
            connectTimeout: TIMEOUT_MS,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableOfflineQueue: false,
            retryStrategy(times) {
              if (times > 3) return null;
              return Math.min(times * 500, 2000);
            },
          });
          healthRedisClient.on('error', (err) => {
            logger.warn({ err: err.message }, '[HEALTH_CHECK] Redis client background warning');
          });
        }

        const client = healthRedisClient;
        if (client.status === 'wait' || client.status === 'close' || client.status === 'end') {
          await withTimeout(client.connect(), TIMEOUT_MS, 'RedisConnect');
        } else if (client.status === 'connecting' || client.status === 'reconnecting') {
          await withTimeout(
            new Promise((resolve, reject) => {
              client.once('ready', resolve);
              client.once('error', reject);
            }),
            TIMEOUT_MS,
            'RedisConnect'
          );
        }

        const ping = await withTimeout(client.ping(), TIMEOUT_MS, 'RedisPing');
        const latencyMs = Date.now() - start;
        const status = ping === 'PONG' ? 'ok' : 'degraded';
        return { status, latencyMs, type: 'self-hosted', error: status === 'ok' ? null : 'Unexpected ping response' };
      } catch (error) {
        logger.error({ err: error }, '[HEALTH_CHECK] Redis (self-hosted) connection failed');
        // Reset client on critical connection error so subsequent check attempts fresh recovery
        HealthService.resetRedisClient();
        return { status: 'error', latencyMs: -1, error: error.message };
      }
    }

    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const start = Date.now();
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ping = await withTimeout(redis.ping(), TIMEOUT_MS, 'Redis');
        const latencyMs = Date.now() - start;
        const status = ping === 'PONG' ? 'ok' : 'degraded';
        return { status, latencyMs, type: 'upstash', error: status === 'ok' ? null : 'Unexpected ping response' };
      } catch (error) {
        logger.error({ err: error }, '[HEALTH_CHECK] Redis (Upstash) connection failed');
        return { status: 'error', latencyMs: -1, error: error.message };
      }
    }

    return { status: 'not_configured', latencyMs: 0, error: null };
  }

  static checkEmailConfig() {
    try {
      const hasCategorizedKeys = !!(
        process.env.BREVO_API_KEY_AUTH_OTP ||
        process.env.BREVO_API_KEY_PASSWORD_RECOVERY ||
        process.env.BREVO_API_KEY_SECURITY_ALERTS ||
        process.env.BREVO_API_KEY_STAFF_ONBOARDING ||
        process.env.BREVO_API_KEY_ADMISSIONS ||
        process.env.BREVO_API_KEY_SCHOLARSHIP ||
        process.env.BREVO_API_KEY_SYSTEM_OPERATIONS
      );
      const hasCategorizedSenders = !!(
        process.env.BREVO_SENDER_EMAIL_AUTH_OTP ||
        process.env.BREVO_SENDER_EMAIL_PASSWORD_RECOVERY ||
        process.env.BREVO_SENDER_EMAIL_SECURITY_ALERTS ||
        process.env.BREVO_SENDER_EMAIL_STAFF_ONBOARDING ||
        process.env.BREVO_SENDER_EMAIL_ADMISSIONS ||
        process.env.BREVO_SENDER_EMAIL_SCHOLARSHIP ||
        process.env.BREVO_SENDER_EMAIL_SYSTEM_OPERATIONS
      );
      const hasSender = !!(process.env.EMAIL_USER || hasCategorizedSenders);
      const hasKey = !!(process.env.BREVO_API_KEY || hasCategorizedKeys);

      if (hasKey && hasSender) {
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
      return {
        status: isAvailable ? 'ok' : 'error',
        latencyMs: Date.now() - start,
        type: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'local',
      };
    } catch (error) {
      logger.error({ err: error }, '[HEALTH_CHECK] Storage provider check failed');
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
   * Determine overall system status based on component statuses.
   * Database is critical: if DB is down, overall status is 'unhealthy' (503).
   * Secondary dependencies (Redis cache, Brevo email) degrade features but keep CMS alive ('degraded', 200).
   */
  static determineStatus(dbStatus, redisStatus, emailStatus) {
    const knownStatuses = new Set([
      'error', 'unhealthy', 'degraded', 'missing_credentials',
      'ok', 'configured', 'not_configured'
    ]);

    const statuses = [dbStatus, redisStatus, emailStatus].filter(Boolean);
    for (const s of statuses) {
      if (!knownStatuses.has(s)) {
        logger.warn({ status: s }, 'Unknown health status');
      }
    }

    if (dbStatus === 'error' || dbStatus === 'unhealthy') {
      return 'unhealthy';
    }

    if (
      redisStatus === 'error' ||
      redisStatus === 'degraded' ||
      emailStatus === 'error' ||
      emailStatus === 'missing_credentials' ||
      emailStatus === 'degraded'
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Fast, zero-dependency liveness check to confirm process is running
   */
  static getLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * Readiness probe verifying that critical persistent storage / database is reachable
   */
  static async getReadiness() {
    const dbRes = await this.checkDatabase();
    const isReady = dbRes.status === 'ok';
    return {
      status: isReady ? 'ready' : 'unhealthy',
      ready: isReady,
      timestamp: new Date().toISOString(),
      components: {
        database: dbRes,
      },
    };
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
      uptimeSeconds: Math.round(process.uptime()),
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
