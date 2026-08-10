import { getStorageProvider } from '@/lib/providers/storage/factory';
import { db } from '@/db';
import { studentImages, studentSignatures } from '@/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';

import { STORAGE_FOLDERS } from '@/lib/storage-config';

/**
 * Patterns that indicate a file is in temporary/staging storage.
 */
const TEMP_PFP_PATTERNS = [/requests\/pfp\//, /admission_drafts\/pfp\//];
const TEMP_SIG_PATTERNS = [/requests\/signatures\//, /admission_drafts\/signatures\//];

/**
 * Media Promotion Service
 * Enforces the institutional storage lifecycle:
 * Temporary Staging (requests/, admission_drafts/) → Permanent Student Storage (students/)
 *
 * All physical moves MUST use StorageProvider.moveFile().
 */
export class MediaPromotionService {
  /**
   * Checks if a storage key is in a temporary/staging location for PFPs.
   * @param {string} key 
   * @returns {boolean}
   */
  static isTemporaryPfp(key) {
    if (!key || typeof key !== 'string') return false;
    return TEMP_PFP_PATTERNS.some(p => p.test(key));
  }

  /**
   * Checks if a storage key is in a temporary/staging location for Signatures.
   * @param {string} key 
   * @returns {boolean}
   */
  static isTemporarySignature(key) {
    if (!key || typeof key !== 'string') return false;
    return TEMP_SIG_PATTERNS.some(p => p.test(key));
  }

  /**
   * Checks if a storage key is temporary (either PFP or Signature).
   * @param {string} key 
   * @returns {boolean}
   */
  static isTemporaryKey(key) {
    return this.isTemporaryPfp(key) || this.isTemporarySignature(key);
  }

  /**
   * Promotes a profile photo from temporary staging to permanent student storage.
   * @param {string} sourceKey - e.g., 'kucet/requests/pfp/abc.jpg' or 'admission_drafts/pfp/abc.jpg'
   * @returns {Promise<{ newKey: string, originalKey: string, moved: boolean }>}
   */
  static async promoteStudentProfile(sourceKey) {
    if (!sourceKey || typeof sourceKey !== 'string') {
      return { newKey: sourceKey, originalKey: sourceKey, moved: false };
    }

    if (!this.isTemporaryPfp(sourceKey)) {
      // Already permanent or non-temporary
      return { newKey: sourceKey, originalKey: sourceKey, moved: false };
    }

    const hasKucetPrefix = sourceKey.startsWith('kucet/');
    const targetFolder = hasKucetPrefix ? `kucet/${STORAGE_FOLDERS.STUDENTS_PFP}` : STORAGE_FOLDERS.STUDENTS_PFP;

    try {
      const storage = getStorageProvider();
      const moveResult = await storage.moveFile(sourceKey, targetFolder);
      const newKey = moveResult.newPath || sourceKey;

      logger.info(
        { from: sourceKey, to: newKey, sizeBytes: moveResult.sizeBytes },
        '[MEDIA_PROMOTION_PFP]'
      );

      return { newKey, originalKey: sourceKey, moved: true };
    } catch (error) {
      logger.error(
        { err: error.message, sourceKey, targetFolder },
        '[MEDIA_PROMOTION_PFP_ERROR]'
      );
      throw new Error(`Failed to promote profile photo: ${error.message}`);
    }
  }

  /**
   * Promotes a signature from temporary staging to permanent student storage.
   * @param {string} sourceKey - e.g., 'kucet/requests/signatures/abc.png' or 'admission_drafts/signatures/abc.png'
   * @returns {Promise<{ newKey: string, originalKey: string, moved: boolean }>}
   */
  static async promoteStudentSignature(sourceKey) {
    if (!sourceKey || typeof sourceKey !== 'string') {
      return { newKey: sourceKey, originalKey: sourceKey, moved: false };
    }

    if (!this.isTemporarySignature(sourceKey)) {
      // Already permanent or non-temporary
      return { newKey: sourceKey, originalKey: sourceKey, moved: false };
    }

    const hasKucetPrefix = sourceKey.startsWith('kucet/');
    const targetFolder = hasKucetPrefix ? `kucet/${STORAGE_FOLDERS.STUDENTS_SIGNATURES}` : STORAGE_FOLDERS.STUDENTS_SIGNATURES;

    try {
      const storage = getStorageProvider();
      const moveResult = await storage.moveFile(sourceKey, targetFolder);
      const newKey = moveResult.newPath || sourceKey;

      logger.info(
        { from: sourceKey, to: newKey, sizeBytes: moveResult.sizeBytes },
        '[MEDIA_PROMOTION_SIGNATURE]'
      );

      return { newKey, originalKey: sourceKey, moved: true };
    } catch (error) {
      logger.error(
        { err: error.message, sourceKey, targetFolder },
        '[MEDIA_PROMOTION_SIGNATURE_ERROR]'
      );
      throw new Error(`Failed to promote signature: ${error.message}`);
    }
  }

  /**
   * Atomically promotes media assets associated with a student profile update request.
   * Updates permanent student tables (student_images, student_signatures) inside transaction.
   * Includes rollback safety if DB operations fail.
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string|null} params.newPfp
   * @param {string|null} params.newSignature
   * @param {Object} tx - Drizzle transaction handle
   * @returns {Promise<{ promotedPfp: string|null, promotedSig: string|null }>}
   */
  static async promoteRequestMedia({ studentId, newPfp, newSignature }, tx) {
    if (!studentId) throw new Error('studentId is required for request media promotion');

    let promotedPfp = newPfp;
    let promotedSig = newSignature;
    let movedPfpResult = null;
    let movedSigResult = null;

    try {
      // 1. Physically move PFP if temporary
      if (newPfp && this.isTemporaryPfp(newPfp)) {
        movedPfpResult = await this.promoteStudentProfile(newPfp);
        promotedPfp = movedPfpResult.newKey;
      }

      // 2. Physically move Signature if temporary
      if (newSignature && this.isTemporarySignature(newSignature)) {
        movedSigResult = await this.promoteStudentSignature(newSignature);
        promotedSig = movedSigResult.newKey;
      }

      // 3. Perform DB Updates within Transaction
      const dbHandle = tx || db;

      if (promotedPfp) {
        // Delete old permanent PFP if different
        const oldPfpRow = dbHandle.query?.studentImages
          ? await dbHandle.query.studentImages.findFirst({
              where: eq(studentImages.student_id, studentId)
            })
          : null;

        if (oldPfpRow?.pfp && oldPfpRow.pfp !== promotedPfp && !this.isTemporaryPfp(oldPfpRow.pfp)) {
          const storage = getStorageProvider();
          await storage.delete(oldPfpRow.pfp).catch(err => {
            logger.warn({ err: err.message, oldPfp: oldPfpRow.pfp }, '[MEDIA_PROMOTION_OLD_PFP_DELETE_WARN]');
          });
        }

        await dbHandle.insert(studentImages)
          .values({ student_id: studentId, pfp: promotedPfp })
          .onDuplicateKeyUpdate({ set: { pfp: promotedPfp } });
      }

      if (promotedSig) {
        // Delete old permanent Signature if different
        const oldSigRow = dbHandle.query?.studentSignatures
          ? await dbHandle.query.studentSignatures.findFirst({
              where: eq(studentSignatures.student_id, studentId)
            })
          : null;

        if (oldSigRow?.signature && oldSigRow.signature !== promotedSig && !this.isTemporarySignature(oldSigRow.signature)) {
          const storage = getStorageProvider();
          await storage.delete(oldSigRow.signature).catch(err => {
            logger.warn({ err: err.message, oldSig: oldSigRow.signature }, '[MEDIA_PROMOTION_OLD_SIG_DELETE_WARN]');
          });
        }

        await dbHandle.insert(studentSignatures)
          .values({ student_id: studentId, signature: promotedSig })
          .onDuplicateKeyUpdate({ set: { signature: promotedSig } });
      }

      return { promotedPfp, promotedSig };

    } catch (error) {
      // ROLLBACK SAFETY: Restore files if physical moves succeeded but DB failed
      const storage = getStorageProvider();

      if (movedPfpResult?.moved && movedPfpResult.newKey !== movedPfpResult.originalKey) {
        const origFolder = movedPfpResult.originalKey.substring(0, movedPfpResult.originalKey.lastIndexOf('/'));
        await storage.moveFile(movedPfpResult.newKey, origFolder).catch(rbErr => {
          logger.error({ err: rbErr.message, key: movedPfpResult.newKey }, '[MEDIA_PROMOTION_PFP_ROLLBACK_ERROR]');
        });
      }

      if (movedSigResult?.moved && movedSigResult.newKey !== movedSigResult.originalKey) {
        const origFolder = movedSigResult.originalKey.substring(0, movedSigResult.originalKey.lastIndexOf('/'));
        await storage.moveFile(movedSigResult.newKey, origFolder).catch(rbErr => {
          logger.error({ err: rbErr.message, key: movedSigResult.newKey }, '[MEDIA_PROMOTION_SIG_ROLLBACK_ERROR]');
        });
      }

      throw error;
    }
  }

  /**
   * Promotes media assets when finalizing an admission draft into a real student.
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string|null} params.pfp
   * @param {string|null} params.signature
   * @param {Object} tx - Drizzle transaction handle
   * @returns {Promise<{ promotedPfp: string|null, promotedSig: string|null }>}
   */
  static async promoteAdmissionMedia({ studentId, pfp, signature }, tx) {
    return this.promoteRequestMedia({ studentId, newPfp: pfp, newSignature: signature }, tx);
  }
}
