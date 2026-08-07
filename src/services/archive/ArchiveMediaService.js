import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';

/**
 * Archive Media Service
 * Manages archival movement and restoration of student media, signatures, and payment evidence
 * using the institutional Storage Provider abstraction (Cloudinary, AWS S3, Cloudflare R2, Local).
 */
export class ArchiveMediaService {
  /**
   * Move an operational file asset to the archive namespace
   * @param {string} originalPath - Operational relative file path
   * @param {string} targetFolder - Subfolder namespace under archive/ (e.g. 'students/2026/CSE/profile')
   * @returns {Promise<{ newPath: string, sizeBytes: number }>}
   */
  static async archiveMediaFile(originalPath, targetFolder = 'general') {
    if (!originalPath || typeof originalPath !== 'string') {
      return { newPath: null, sizeBytes: 0 };
    }

    // Skip Data URIs or external absolute URLs that cannot be moved directly
    if (originalPath.startsWith('data:') || originalPath.startsWith('http://') || originalPath.startsWith('https://')) {
      return { newPath: originalPath, sizeBytes: 0 };
    }

    // Don't re-archive already archived paths
    if (originalPath.startsWith('archive/')) {
      return { newPath: originalPath, sizeBytes: 0 };
    }

    try {
      const storage = getStorageProvider();
      const archiveFolderPath = `archive/${targetFolder.replace(/^\/+|\/+$/g, '')}`;
      
      const moveResult = await storage.moveFile(originalPath, archiveFolderPath);
      logger.info({ from: originalPath, to: moveResult.newPath, sizeBytes: moveResult.sizeBytes }, '[ARCHIVE_MEDIA_MOVE]');
      
      return {
        newPath: moveResult.newPath,
        sizeBytes: moveResult.sizeBytes || 1024,
      };
    } catch (error) {
      logger.error({ err: error.message, originalPath }, '[ARCHIVE_MEDIA_ERROR]');
      return { newPath: originalPath, sizeBytes: 0 };
    }
  }

  /**
   * Restore an archived media file back to operational namespace
   * @param {string} archivedPath 
   * @param {string} targetFolder 
   * @returns {Promise<string>}
   */
  static async restoreMediaFile(archivedPath, targetFolder = 'uploads') {
    if (!archivedPath || typeof archivedPath !== 'string') {
      return null;
    }

    if (!archivedPath.startsWith('archive/')) {
      return archivedPath;
    }

    try {
      const storage = getStorageProvider();
      const moveResult = await storage.moveFile(archivedPath, targetFolder);
      logger.info({ from: archivedPath, to: moveResult.newPath }, '[RESTORE_MEDIA_MOVE]');
      return moveResult.newPath;
    } catch (error) {
      logger.error({ err: error.message, archivedPath }, '[RESTORE_MEDIA_ERROR]');
      return archivedPath;
    }
  }
}
