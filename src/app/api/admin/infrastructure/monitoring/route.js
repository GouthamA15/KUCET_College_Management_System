import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import HealthService from '@/services/shared/HealthService';
import { db } from '@/db';
import { userSessions, students } from '@/db/schema';
import { sql } from 'drizzle-orm';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const diagnostics = await HealthService.getFullDiagnostics();

    // Active sessions & student counts
    const activeSessionsCount = await db.select({ count: sql`count(*)` }).from(userSessions);
    const totalStudentsCount = await db.select({ count: sql`count(*)` }).from(students);

    const metrics = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'production',
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      stats: {
        activeSessions: Number(activeSessionsCount[0]?.count || 0),
        totalStudents: Number(totalStudentsCount[0]?.count || 0),
      },
      diagnostics,
    };

    logger.info({ admin: user.email }, '[ADMIN_MONITORING_FETCHED]');
    return apiResponse(metrics);
  } catch (error) {
    logger.error(error, 'Error fetching monitoring metrics');
    return apiError(error.message || 'Failed to fetch monitoring metrics', 500);
  }
}
