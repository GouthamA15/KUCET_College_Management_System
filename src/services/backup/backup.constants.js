/**
 * Database Backup & Recovery System Constants
 */

export const BACKUP_CONSTANTS = {
  // Retention limit in days
  RETENTION_DAYS: 14,
  
  // Default directory paths
  DEFAULT_VPS_BACKUP_PATH: '/var/kucet-db-backup',
  FALLBACK_LOCAL_BACKUP_PATH: 'backups',
  
  // Lock timeout (15 minutes in milliseconds)
  LOCK_TIMEOUT_MS: 15 * 60 * 1000,
  
  // File naming pattern prefix
  FILENAME_PREFIX: 'kucet_cms_',
  
  // Confirmation phrase required for destructive restore
  RESTORE_CONFIRM_PHRASE: 'RESTORE',
  
  // Allowed backup types
  BACKUP_TYPES: {
    SCHEDULED: 'SCHEDULED',
    MANUAL: 'MANUAL',
    EMERGENCY_PRE_RESTORE: 'EMERGENCY_PRE_RESTORE'
  },
  
  // Statuses
  STATUS: {
    IN_PROGRESS: 'IN_PROGRESS',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED'
  }
};

export default BACKUP_CONSTANTS;
