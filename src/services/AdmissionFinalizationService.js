import { db } from '@/db';
import { studentAdmissionDrafts, systemConfigs } from '@/db/schema';
import { eq, like, and, ne } from 'drizzle-orm';
import { getIntakeYear } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export const BRANCH_NAMES = {
  CSE: 'Computer Science & Engineering',
  IT: 'Information Technology',
  MECH: 'Mechanical Engineering',
  CIVIL: 'Civil Engineering',
  ECE: 'Electronics & Communication Engineering',
  EEE: 'Electrical & Electronics Engineering',
  CSD: 'Computer Science & Data Science',
};

export const FINALIZATION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  FINALIZED: 'FINALIZED',
  UNAVAILABLE: 'UNAVAILABLE',
};

// In-memory status cache with 60-second TTL
const statusCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

export class AdmissionFinalizationService {
  /**
   * Clears the in-memory branch finalization cache.
   */
  static invalidateCache(branch = null, admissionYear = null) {
    if (branch && admissionYear) {
      const key = `${String(branch).toUpperCase()}:${admissionYear}`;
      statusCache.delete(key);
    } else {
      statusCache.clear();
    }
  }

  /**
   * Retrieves the authoritative branch finalization status for an intake batch.
   * Order of truth:
   * 1. Dynamic check on student_admission_drafts (active workflow)
   * 2. Persistent branch status records in system_configs (ADMISSION_BRANCH_STATUS)
   * 3. Fallback: UNAVAILABLE if no records or drafts exist for this batch
   */
  static async getBranchFinalizationStatus({ branch, admissionYear = null }) {
    if (!branch || typeof branch !== 'string') {
      return {
        status: FINALIZATION_STATUS.UNAVAILABLE,
        branch: null,
        branchName: null,
        admissionYear: null,
      };
    }

    const normBranch = branch.trim().toUpperCase();
    const activeYear = admissionYear ? Number(admissionYear) : getIntakeYear();
    const branchName = BRANCH_NAMES[normBranch] || normBranch;
    const cacheKey = `${normBranch}:${activeYear}`;

    // 1. Check in-memory cache
    const cached = statusCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // 2. Fetch explicit stored branch status from system_configs if available
      let explicitStatus = null;
      try {
        const configRows = await db.select()
          .from(systemConfigs)
          .where(eq(systemConfigs.config_key, 'ADMISSION_BRANCH_STATUS'))
          .limit(1);

        if (configRows.length > 0 && configRows[0].config_value) {
          const parsed = JSON.parse(configRows[0].config_value);
          const yearMap = parsed[String(activeYear)] || parsed;
          if (yearMap && yearMap[normBranch]) {
            explicitStatus = yearMap[normBranch];
          }
        }
      } catch (_cfgErr) {
        // Non-fatal if system_configs query fails or JSON is malformed
      }

      // 3. Query student_admission_drafts for live workflow status
      const drafts = await db.select({
        status: studentAdmissionDrafts.status,
      })
      .from(studentAdmissionDrafts)
      .where(
        and(
          eq(studentAdmissionDrafts.branch, normBranch),
          like(studentAdmissionDrafts.admission_year, `${activeYear}%`),
          ne(studentAdmissionDrafts.status, 'REJECTED')
        )
      );

      let derivedStatus = FINALIZATION_STATUS.UNAVAILABLE;

      if (drafts.length > 0) {
        let finalizedCount = 0;
        let pendingCount = 0;

        for (const d of drafts) {
          if (d.status === 'FINALIZED') finalizedCount++;
          else if (['PROCESSED', 'DRAFT'].includes(d.status)) pendingCount++;
        }

        if (finalizedCount > 0 && pendingCount === 0) {
          derivedStatus = FINALIZATION_STATUS.FINALIZED;
        } else if (finalizedCount > 0 && pendingCount > 0) {
          derivedStatus = FINALIZATION_STATUS.IN_PROGRESS;
        } else if (finalizedCount === 0 && pendingCount > 0) {
          derivedStatus = FINALIZATION_STATUS.NOT_STARTED;
        }
      }

      // 4. Determine authoritative final status:
      // If live drafts show IN_PROGRESS, workflow is currently running (cannot be prematurely FINALIZED).
      // If live drafts show FINALIZED, branch is complete.
      // If live drafts show NOT_STARTED, branch is pending.
      // If live drafts are empty/unavailable, fall back to explicit status from system_configs if present.
      let finalStatus = FINALIZATION_STATUS.UNAVAILABLE;
      if (derivedStatus !== FINALIZATION_STATUS.UNAVAILABLE) {
        finalStatus = derivedStatus;
      } else if (explicitStatus && Object.values(FINALIZATION_STATUS).includes(explicitStatus)) {
        finalStatus = explicitStatus;
      }

      const result = {
        status: finalStatus,
        branch: normBranch,
        branchName,
        admissionYear: activeYear,
        totalDrafts: drafts.length,
      };

      statusCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;

    } catch (err) {
      logger.error({ err: err.message, branch: normBranch, activeYear }, '[AdmissionFinalizationService] Query error');
      return {
        status: FINALIZATION_STATUS.UNAVAILABLE,
        branch: normBranch,
        branchName,
        admissionYear: activeYear,
      };
    }
  }

  /**
   * Explicitly sets a branch finalization status in system_configs.
   * Only authorized staff/admin may execute this.
   */
  static async setBranchStatus({ branch, admissionYear = null, status, updatedBy = 'system' }) {
    if (!branch || !status) {
      throw new Error('Branch and status are required');
    }
    const normBranch = branch.trim().toUpperCase();
    if (!BRANCH_NAMES[normBranch] && !Object.keys(BRANCH_NAMES).includes(normBranch)) {
      throw new Error(`Invalid branch code: ${normBranch}`);
    }
    if (![FINALIZATION_STATUS.NOT_STARTED, FINALIZATION_STATUS.IN_PROGRESS, FINALIZATION_STATUS.FINALIZED].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const activeYear = admissionYear ? Number(admissionYear) : getIntakeYear();

    // Fetch existing or initialize
    const existing = await db.select()
      .from(systemConfigs)
      .where(eq(systemConfigs.config_key, 'ADMISSION_BRANCH_STATUS'))
      .limit(1);

    let configData = {};
    if (existing.length > 0 && existing[0].config_value) {
      try {
        configData = JSON.parse(existing[0].config_value);
      } catch (_e) {
        configData = {};
      }
    }

    const yearKey = String(activeYear);
    if (!configData[yearKey]) configData[yearKey] = {};
    configData[yearKey][normBranch] = status;

    const jsonValue = JSON.stringify(configData);

    if (existing.length > 0) {
      await db.update(systemConfigs)
        .set({
          config_value: jsonValue,
          data_type: 'JSON',
          updated_at: new Date(),
          updated_by: updatedBy,
        })
        .where(eq(systemConfigs.config_key, 'ADMISSION_BRANCH_STATUS'));
    } else {
      await db.insert(systemConfigs).values({
        config_key: 'ADMISSION_BRANCH_STATUS',
        config_value: jsonValue,
        data_type: 'JSON',
        description: 'Dynamic branch-wide admission finalization status tracking',
        updated_by: updatedBy,
      });
    }

    // Invalidate cache immediately
    this.invalidateCache(normBranch, activeYear);

    return {
      success: true,
      branch: normBranch,
      admissionYear: activeYear,
      status,
    };
  }

  /**
   * Hook called when a draft is finalized in /api/staff/admission/drafts/[id]/finalize.
   * Verifies if any drafts for this branch remain PROCESSED or DRAFT.
   * If none remain, updates branch status to FINALIZED. Otherwise, marks IN_PROGRESS.
   */
  static async handleDraftFinalized({ branch, admissionYear = null, updatedBy = 'admission_workflow' }) {
    if (!branch) return;
    const normBranch = branch.trim().toUpperCase();
    const activeYear = admissionYear ? Number(admissionYear) : getIntakeYear();

    try {
      const remainingDrafts = await db.select({
        status: studentAdmissionDrafts.status,
      })
      .from(studentAdmissionDrafts)
      .where(
        and(
          eq(studentAdmissionDrafts.branch, normBranch),
          like(studentAdmissionDrafts.admission_year, `${activeYear}%`),
          ne(studentAdmissionDrafts.status, 'REJECTED')
        )
      );

      let pending = 0;
      let finalized = 0;
      for (const d of remainingDrafts) {
        if (d.status === 'FINALIZED') finalized++;
        else if (['PROCESSED', 'DRAFT'].includes(d.status)) pending++;
      }

      const newStatus = (finalized > 0 && pending === 0)
        ? FINALIZATION_STATUS.FINALIZED
        : FINALIZATION_STATUS.IN_PROGRESS;

      await this.setBranchStatus({
        branch: normBranch,
        admissionYear: activeYear,
        status: newStatus,
        updatedBy,
      });

      this.invalidateCache(normBranch, activeYear);
    } catch (err) {
      logger.warn({ err: err.message, branch: normBranch }, '[AdmissionFinalizationService] handleDraftFinalized error');
    }
  }

  /**
   * Retrieves finalization status summary across all institutional branches.
   */
  static async getAllBranchStatuses(admissionYear = null) {
    const activeYear = admissionYear ? Number(admissionYear) : getIntakeYear();
    const branches = Object.keys(BRANCH_NAMES);
    const results = {};

    for (const b of branches) {
      results[b] = await this.getBranchFinalizationStatus({ branch: b, admissionYear: activeYear });
    }

    return {
      admissionYear: activeYear,
      branches: results,
    };
  }
}

export default AdmissionFinalizationService;
