import { apiResponse, apiError } from "@/lib/api-utils";
import logger from "@/lib/logger";
import { getNow } from "@/lib/clock";
import { HealthService } from "@/services/HealthService";

/**
 * Deployment Health Check API
 * Verifies critical infrastructure connections: Database, Redis, and Email Config.
 */
export async function GET(request) {
  const dbCheck = await HealthService.checkDatabase();
  const redisCheck = await HealthService.checkRedis();
  const emailCheck = HealthService.checkEmailConfig();

  const hasCriticalError = HealthService.isCriticalError(dbCheck.status, emailCheck.status);
  const overallStatus = HealthService.determineStatus(dbCheck.status, redisCheck.status, emailCheck.status);

  const status = {
    status: overallStatus,
    database: dbCheck.status,
    redis: redisCheck.status,
    email_service: emailCheck.status,
    timestamp: getNow().toISOString()
  };

  // Respond with 503 if any critical service (DB, email) is down
  if (hasCriticalError) {
    return apiError("System Unhealthy", 503, status);
  }

  return apiResponse(status);
}
