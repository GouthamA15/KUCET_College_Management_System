import { db } from '@/db';
import { 
  studentImages, studentSignatures, clerks,
  archiveStudents, archiveStudentPersonalDetails, archiveStudentPayments,
  studentProfileRequests, studentAdmissionDrafts, bugReports, studentRequestImages
} from '@/db/schema';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * Patterns that indicate a value is a URL violation (not a storage key).
 * These should never appear in the database.
 */
const URL_VIOLATION_PATTERNS = [
  /^https?:\/\//,          // Full HTTP/HTTPS URLs
  /cloudinary\.com/,       // Cloudinary domains
  /amazonaws\.com/,        // S3 domains
  /\[object/,              // [object Object] corruption
  /^v\d+\//,              // Versioned Cloudinary paths (v1234567/kucet/...)
];

/**
 * Checks if a value is a URL violation (should be a storage key but isn't).
 */
function isUrlViolation(value) {
  if (!value || typeof value !== 'string') return false;
  return URL_VIOLATION_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Orphan Media Cleanup Service
 * Detects, reports, and safely cleans unreferenced files from storage providers.
 */
export class OrphanMediaService {
  /**
   * Collect set of all active and archived file asset paths referenced in database
   * @returns {Promise<Set<string>>}
   */
  static async getReferencedMediaPaths() {
    const referenced = new Set();

    try {
      // 1. Student Images PFP
      const studentPfps = await db.select({ pfp: studentImages.pfp }).from(studentImages);
      studentPfps.forEach(s => s.pfp && referenced.add(s.pfp.replace(/^\/+/, '')));

      // 2. Student Signatures
      const sigs = await db.select({ signature: studentSignatures.signature }).from(studentSignatures);
      sigs.forEach(s => s.signature && referenced.add(s.signature.replace(/^\/+/, '')));

      // 3. Clerks / Faculty PFP & Signatures
      const clerkMedia = await db.select({ pfp: clerks.pfp, signature: clerks.signature }).from(clerks);
      clerkMedia.forEach(c => {
        c.pfp && referenced.add(c.pfp.replace(/^\/+/, ''));
        c.signature && referenced.add(c.signature.replace(/^\/+/, ''));
      });

      // 4. Payment Screenshots (canonical source: student_request_images)
      const payments = await db.select({ path: studentRequestImages.payment_screenshot }).from(studentRequestImages);
      payments.forEach(p => p.path && referenced.add(p.path.replace(/^\/+/, '')));

      // 5. Profile Requests
      const profileReqs = await db.select({ 
        sig: studentProfileRequests.new_signature,
        pfp: studentProfileRequests.new_pfp,
        proof: studentProfileRequests.proof_url
      }).from(studentProfileRequests);
      profileReqs.forEach(r => {
        r.sig && referenced.add(r.sig.replace(/^\/+/, ''));
        r.pfp && referenced.add(r.pfp.replace(/^\/+/, ''));
        r.proof && referenced.add(r.proof.replace(/^\/+/, ''));
      });

      // 6. Admission Drafts
      const drafts = await db.select({ pfp: studentAdmissionDrafts.pfp, sig: studentAdmissionDrafts.signature }).from(studentAdmissionDrafts);
      drafts.forEach(d => {
        d.pfp && referenced.add(d.pfp.replace(/^\/+/, ''));
        d.sig && referenced.add(d.sig.replace(/^\/+/, ''));
      });

      // 7. Bug Reports
      const bugs = await db.select({ url: bugReports.screenshot_url }).from(bugReports);
      bugs.forEach(b => b.url && referenced.add(b.url.replace(/^\/+/, '')));

      // 8. Archived Media
      const archPfps = await db.select({ pfp: archiveStudents.pfp }).from(archiveStudents);
      archPfps.forEach(a => a.pfp && referenced.add(a.pfp.replace(/^\/+/, '')));

      const archSigs = await db.select({ path: archiveStudentPersonalDetails.signature_path }).from(archiveStudentPersonalDetails);
      archSigs.forEach(a => a.path && referenced.add(a.path.replace(/^\/+/, '')));

      const archPayments = await db.select({ path: archiveStudentPayments.payment_screenshot_path }).from(archiveStudentPayments);
      archPayments.forEach(a => a.path && referenced.add(a.path.replace(/^\/+/, '')));

      return referenced;
    } catch (error) {
      logger.error({ err: error.message }, '[GET_REFERENCED_MEDIA_PATHS_ERROR]');
      throw error;
    }
  }

  /**
   * Scan the database for URL violations (values that should be storage keys but are URLs).
   * These indicate architectural violations that need migration.
   * @returns {Promise<{ violations: Array, corruptValues: Array, totalScanned: number }>}
   */
  static async scanDatabaseViolations() {
    const violations = [];
    const corruptValues = [];

    const columnsToScan = [
      { table: 'student_images', column: 'pfp', pkField: 'student_id', query: () => db.select({ pk: studentImages.student_id, val: studentImages.pfp }).from(studentImages) },
      { table: 'student_signatures', column: 'signature', pkField: 'student_id', query: () => db.select({ pk: studentSignatures.student_id, val: studentSignatures.signature }).from(studentSignatures) },
      { table: 'clerks', column: 'pfp', pkField: 'id', query: () => db.select({ pk: clerks.id, val: clerks.pfp }).from(clerks) },
      { table: 'clerks', column: 'signature', pkField: 'id', query: () => db.select({ pk: clerks.id, val: clerks.signature }).from(clerks) },
    ];

    let totalScanned = 0;

    for (const colDef of columnsToScan) {
      try {
        const rows = await colDef.query();
        totalScanned += rows.length;
        rows.forEach(row => {
          if (!row.val) return;
          if (row.val.includes('[object')) {
            corruptValues.push({ table: colDef.table, column: colDef.column, pk: row.pk, value: row.val });
          } else if (isUrlViolation(row.val)) {
            violations.push({ table: colDef.table, column: colDef.column, pk: row.pk, value: row.val });
          }
        });
      } catch (error) {
        logger.warn({ err: error.message, table: colDef.table }, '[VIOLATION_SCAN_PARTIAL_ERROR]');
      }
    }

    logger.info({ totalScanned, violationCount: violations.length, corruptCount: corruptValues.length }, '[DB_VIOLATION_SCAN_COMPLETE]');
    
    return { violations, corruptValues, totalScanned };
  }

  /**
   * Scan storage and detect unreferenced orphan media files
   * @param {{ dryRun?: boolean }} options
   * @returns {Promise<{ dryRun: boolean, totalChecked: number, orphanCount: number, orphanPaths: string[], bytesFreed: number }>}
   */
  static async scanOrphanMedia({ dryRun = true } = {}) {
    try {
      const referencedPaths = await this.getReferencedMediaPaths();
      const storage = getStorageProvider();

      const STORAGE_PATH = getLocalStorageBasePath();
      const orphanPaths = [];
      let totalChecked = 0;
      let bytesFreed = 0;

      // Recursive scanner for local storage
      const scanDir = async (dirPath, relativeSubDir = '') => {
        if (!fs.existsSync(dirPath)) return;

        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = relativeSubDir ? `${relativeSubDir}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await scanDir(fullPath, relativePath);
          } else if (entry.isFile()) {
            totalChecked++;
            const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

            if (!referencedPaths.has(cleanRel)) {
              orphanPaths.push(cleanRel);
              const stats = await fs.promises.stat(fullPath).catch(() => ({ size: 0 }));
              bytesFreed += stats.size || 0;

              if (!dryRun) {
                await storage.delete(cleanRel);
                logger.info({ path: cleanRel }, '[ORPHAN_MEDIA_DELETED]');
              }
            }
          }
        }
      };

      await scanDir(STORAGE_PATH);

      logger.info({ dryRun, totalChecked, orphanCount: orphanPaths.length, bytesFreed }, '[ORPHAN_MEDIA_SCAN_COMPLETED]');

      return {
        dryRun,
        totalChecked,
        orphanCount: orphanPaths.length,
        orphanPaths,
        bytesFreed,
      };
    } catch (error) {
      logger.error({ err: error.message }, '[SCAN_ORPHAN_MEDIA_ERROR]');
      throw new Error(`Orphan media scan failed: ${error.message}`);
    }
  }

  /**
   * Specifically scan temporary staging directories (requests/, admission_drafts/)
   * to detect files remaining after approval or finalization.
   * @returns {Promise<{ stagingOrphans: string[], count: number }>}
   */
  static async scanStagingOrphans() {
    const { orphanPaths } = await this.scanOrphanMedia({ dryRun: true });
    const stagingOrphans = orphanPaths.filter(p => 
      p.includes('requests/pfp/') ||
      p.includes('requests/signatures/') ||
      p.includes('admission_drafts/pfp/') ||
      p.includes('admission_drafts/signatures/')
    );

    logger.info({ count: stagingOrphans.length, stagingOrphans }, '[STAGING_ORPHANS_SCAN_COMPLETE]');
    return { stagingOrphans, count: stagingOrphans.length };
  }
}
