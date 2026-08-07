import { db } from '@/db';
import { 
  students, studentPersonalDetails, clerks, studentFeePayments,
  archiveStudents, archiveStudentPersonalDetails, archiveStudentPayments
} from '@/db/schema';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';

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
      // 1. Operational Students PFP
      const studentPfps = await db.select({ pfp: students.pfp }).from(students);
      studentPfps.forEach(s => s.pfp && referenced.add(s.pfp.replace(/^\/+/, '')));

      // 2. Personal Details Signatures
      const sigs = await db.select({ signature_path: studentPersonalDetails.signature_path }).from(studentPersonalDetails);
      sigs.forEach(s => s.signature_path && referenced.add(s.signature_path.replace(/^\/+/, '')));

      // 3. Clerks / Faculty PFP & Signatures
      const clerkMedia = await db.select({ pfp: clerks.pfp, signature: clerks.signature }).from(clerks);
      clerkMedia.forEach(c => {
        c.pfp && referenced.add(c.pfp.replace(/^\/+/, ''));
        c.signature && referenced.add(c.signature.replace(/^\/+/, ''));
      });

      // 4. Payment Screenshots
      const payments = await db.select({ path: studentFeePayments.payment_screenshot_path }).from(studentFeePayments);
      payments.forEach(p => p.path && referenced.add(p.path.replace(/^\/+/, '')));

      // 5. Archived Student PFP
      const archPfps = await db.select({ pfp: archiveStudents.pfp }).from(archiveStudents);
      archPfps.forEach(a => a.pfp && referenced.add(a.pfp.replace(/^\/+/, '')));

      // 6. Archived Signatures
      const archSigs = await db.select({ path: archiveStudentPersonalDetails.signature_path }).from(archiveStudentPersonalDetails);
      archSigs.forEach(a => a.path && referenced.add(a.path.replace(/^\/+/, '')));

      // 7. Archived Payments
      const archPayments = await db.select({ path: archiveStudentPayments.payment_screenshot_path }).from(archiveStudentPayments);
      archPayments.forEach(a => a.path && referenced.add(a.path.replace(/^\/+/, '')));

      return referenced;
    } catch (error) {
      logger.error({ err: error.message }, '[GET_REFERENCED_MEDIA_PATHS_ERROR]');
      throw error;
    }
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

      const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
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
}
