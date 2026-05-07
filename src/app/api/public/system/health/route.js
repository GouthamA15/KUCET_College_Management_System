import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Redis } from '@upstash/redis';
import { apiResponse, apiError } from "@/lib/api-utils";
import logger from "@/lib/logger";

/**
 * Deployment Health Check API
 * Verifies critical infrastructure connections: Database, Redis, and Email Config.
 */
export async function GET(request) {
  const status = {
    status: "healthy",
    database: "unknown",
    redis: "not_configured",
    email_service: "unknown",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  };

  let hasCriticalError = false;

  // 1. Database Integrity Check
  try {
    // Simple query to verify connection and read-readiness
    await db.execute(sql`SELECT 1`);
    status.database = "ok";
  } catch (error) {
    status.database = "error";
    status.status = "unhealthy";
    logger.error("[HEALTH_CHECK] Database connection failed:", error.message);
    hasCriticalError = true;
  }

  // 2. Redis Connectivity Check (Distributed Caching & Rate Limiting)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      // Ping Redis to verify connectivity
      const ping = await redis.ping();
      status.redis = ping === "PONG" ? "ok" : "degraded";
      
      // Redis failure is considered "degraded" as we have MySQL fallback
      if (status.redis !== "ok") {
        status.status = "degraded";
      }
    } catch (error) {
      status.redis = "error";
      status.status = "degraded";
      logger.error("[HEALTH_CHECK] Redis connection failed:", error.message);
    }
  }

  // 3. Email Service Configuration Check (Critical for OTP/Notifications)
  if (process.env.BREVO_API_KEY && process.env.EMAIL_USER) {
    // We only check for presence of keys as hitting the external API might consume quota
    status.email_service = "configured";
  } else {
    status.email_service = "missing_credentials";
    status.status = "degraded";
    hasCriticalError = true;
  }

  // Respond with 503 if any critical service (DB) is down
  if (hasCriticalError) {
    return apiError("System Unhealthy", 503, status);
  }

  return apiResponse(status);
}
