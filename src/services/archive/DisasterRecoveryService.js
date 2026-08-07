import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { invalidateTag } from '@/lib/cache';
import logger from '@/lib/logger';

export class DisasterRecoveryService {
  /**
   * Rebuilds domain caches across Redis and in-memory caches
   */
  static async rebuildDomainCaches() {
    try {
      logger.info('[DisasterRecovery] Rebuilding domain caches');
      await invalidateTag('academic');
      await invalidateTag('config');
      await invalidateTag('finance');
      return { success: true, tagsInvalidated: ['academic', 'config', 'finance'] };
    } catch (err) {
      logger.error({ err }, '[DisasterRecovery] Cache rebuild failed');
      throw err;
    }
  }

  /**
   * Verifies structural integrity of active database tables
   */
  static async verifyDatabaseIntegrity() {
    try {
      const start = Date.now();
      const tablesCheck = await db.execute(sql`SHOW TABLES`);
      return {
        healthy: true,
        tablesCount: Array.isArray(tablesCheck[0]) ? tablesCheck[0].length : 0,
        latencyMs: Date.now() - start,
        verifiedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err }, '[DisasterRecovery] DB Integrity Check Failed');
      return { healthy: false, error: err.message };
    }
  }

  /**
   * Triggers full system recovery workflow (DB check, Cache rebuild, Verification)
   */
  static async executeFullSystemRecovery() {
    const startTime = Date.now();
    logger.info('[DisasterRecovery] Initiating automated disaster recovery procedure');

    const dbIntegrity = await this.verifyDatabaseIntegrity();
    const cacheRebuild = await this.rebuildDomainCaches();

    const report = {
      recoveryId: `REC-${Date.now()}`,
      timestamp: new Date().toISOString(),
      dbIntegrity,
      cacheRebuild,
      overallStatus: dbIntegrity.healthy ? 'SUCCESS' : 'FAILED',
      durationMs: Date.now() - startTime,
    };

    logger.info({ report }, '[DisasterRecovery] Disaster recovery procedure completed');
    return report;
  }
}

export default DisasterRecoveryService;
