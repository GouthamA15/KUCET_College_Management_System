/**
 * ============================================================
 * CENTRALIZED STORAGE CONFIGURATION
 * ============================================================
 * Single source of truth for all storage directories, canonical path
 * structures, and institutional asset classifications across the application.
 *
 * DO NOT hardcode folder paths in API routes or services.
 * Always import from this module.
 * ============================================================
 */

import { INSTITUTION_ASSET_KEYS, INSTITUTIONAL_ASSETS_MAP, isInstitutionalAssetPath, resolveInstitutionalFilename } from './institution-assets';

/**
 * Standardized Canonical Storage Folders
 */
export const STORAGE_FOLDERS = Object.freeze({
  // Student Operational Assets
  STUDENTS_PFP: 'students/pfp',
  STUDENTS_SIGNATURES: 'students/signatures',

  // Request & Staging Media
  REQUESTS_PFP: 'requests/pfp',
  REQUESTS_SIGNATURES: 'requests/signatures',
  REQUESTS_PROOFS: 'requests/proofs',

  // Certificate Verification & Evidence
  CERTIFICATES_PAYMENTS: 'certificates/payments',

  // Admission Pipeline Staging
  ADMISSION_DRAFTS_PFP: 'admission_drafts/pfp',
  ADMISSION_DRAFTS_SIGNATURES: 'admission_drafts/signatures',

  // Faculty / Staff Media
  STAFF_PFP: 'staff/pfp',
  STAFF_SIGNATURES: 'staff/signatures',
  CLERKS_PFP: 'staff/pfp', // Backward compatibility alias
  CLERKS_SIGNATURES: 'staff/signatures', // Backward compatibility alias

  // Operations & Maintenance
  BUG_REPORTS: 'bug_reports',
  BACKUPS: 'backups',

  // Institutional Branding (Permanent & Protected)
  INSTITUTION: 'institution',
});

/**
 * Confidential Institutional Files Registry
 * Protected files that must NEVER be overwritten, deleted, renamed, or exposed to public upload endpoints.
 */
export const CONFIDENTIAL_INSTITUTIONAL_FILES = Object.freeze([
  'ku-college-seal.png',
  'principal-sign.png',
  'principal-signStamp.png',
  'principal-sign-black.png',
  'principal-sign3.png',
  'principal-sign4.png',
  'principal_ku_qr.png',
  'ku-logo.png',
  'ku-college-logo.png',
  'kakatiya-kala-thoranam.png',
  'Naac_A+.png'
]);

/**
 * Storage namespace prefix for cloud storage providers
 */
export const STORAGE_NAMESPACE_PREFIX = 'kucet/';

/**
 * Maximum file upload sizes (bytes)
 */
export const UPLOAD_LIMITS = Object.freeze({
  IMAGE_MAX_BYTES: 1 * 1024 * 1024, // 1MB for profile photo / signature / screenshots
  DOCUMENT_MAX_BYTES: 10 * 1024 * 1024, // 10MB for proof documents
});

export { INSTITUTION_ASSET_KEYS, INSTITUTIONAL_ASSETS_MAP, isInstitutionalAssetPath, resolveInstitutionalFilename };
