import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { spawn } from 'child_process';
import mysqldump from 'mysqldump';
import mysql from 'mysql2/promise';
import logger from '@/lib/logger';
import { db } from '@/db';
import { databaseBackupLogs } from '@/db/schema/operations.js';
import { auditLogs } from '@/db/schema/security.js';
import { eq, desc } from 'drizzle-orm';
import { BACKUP_CONSTANTS } from './backup.constants.js';
import { DisasterRecoveryService } from '@/services/archive/DisasterRecoveryService.js';

export class DatabaseBackupService {
  /**
   * Resolves and ensures the backup storage directory.
   */
  static getBackupDirectory() {
    const configuredPath = process.env.DB_BACKUP_PATH || BACKUP_CONSTANTS.DEFAULT_VPS_BACKUP_PATH;
    try {
      if (!fs.existsSync(configuredPath)) {
        fs.mkdirSync(configuredPath, { recursive: true, mode: 0o755 });
      }
      // Test write access
      fs.accessSync(configuredPath, fs.constants.W_OK);
      return path.resolve(configuredPath);
    } catch (_err) {
      const fallbackPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), BACKUP_CONSTANTS.FALLBACK_LOCAL_BACKUP_PATH);
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true, mode: 0o755 });
      }
      return fallbackPath;
    }
  }

  /**
   * Acquire an atomic operation lock
   */
  static acquireLock(operation = 'backup') {
    const backupDir = this.getBackupDirectory();
    const lockFile = path.join(backupDir, '.backup.lock');

    if (fs.existsSync(lockFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        const ageMs = Date.now() - (content.timestamp || 0);
        if (ageMs < BACKUP_CONSTANTS.LOCK_TIMEOUT_MS) {
          throw new Error(`Another ${content.operation || 'backup/restore'} operation is already in progress (PID: ${content.pid}, age: ${Math.round(ageMs / 1000)}s).`);
        }
        logger.warn({ lockFile, ageMs }, '[DatabaseBackupService] Removing stale lock file');
      } catch (err) {
        if (err.message.includes('already in progress')) {
          throw err;
        }
        // If file was corrupted or unreadable, remove it
        try { fs.unlinkSync(lockFile); } catch (_e) { /* ignore */ }
      }
    }

    const lockData = {
      operation,
      timestamp: Date.now(),
      pid: process.pid,
    };
    fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2), { mode: 0o600 });
    return lockFile;
  }

  /**
   * Release the operation lock
   */
  static releaseLock() {
    try {
      const backupDir = this.getBackupDirectory();
      const lockFile = path.join(backupDir, '.backup.lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[DatabaseBackupService] Failed to cleanly remove lock file');
    }
  }

  /**
   * Calculates SHA-256 checksum of a file
   */
  static async calculateFileSha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  /**
   * Format timestamp for backup filename: YYYY-MM-DD_HH-mm-ss
   */
  static formatTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * Verify database connection is healthy
   */
  static async testConnection() {
    const { getDb } = await import('@/lib/db.js');
    const pool = getDb();
    const [rows] = await pool.query('SELECT 1 as is_alive');
    return rows && rows.length > 0;
  }

  /**
   * Creates a consistent database backup:
   * 1. Acquires lock
   * 2. Tests DB reachability
   * 3. Exports to .sql.tmp
   * 4. Verifies structural integrity
   * 5. Compresses to .sql.gz.tmp
   * 6. Computes SHA-256 checksum
   * 7. Atomically renames to final filename
   * 8. Executes 14-day retention pruning
   * 9. Records status in database_backup_logs
   */
  static async createBackup(options = {}) {
    const {
      triggeredBy = 'SYSTEM_CRON',
      type = BACKUP_CONSTANTS.BACKUP_TYPES.SCHEDULED
    } = options;

    const startTime = Date.now();
    const backupDir = this.getBackupDirectory();
    this.acquireLock(`backup-${type.toLowerCase()}`);

    const timestampStr = this.formatTimestamp();
    const suffix = type === BACKUP_CONSTANTS.BACKUP_TYPES.EMERGENCY_PRE_RESTORE ? '_emergency_pre_restore' : '';
    const finalFilename = `${BACKUP_CONSTANTS.FILENAME_PREFIX}${timestampStr}${suffix}.sql.gz`;
    const finalFilePath = path.join(backupDir, finalFilename);
    const tempSqlPath = path.join(backupDir, `${finalFilename}.tmp.sql`);
    const tempGzPath = path.join(backupDir, `${finalFilename}.tmp.gz`);

    let logId = null;

    try {
      logger.info({ finalFilename, type, triggeredBy }, '[DatabaseBackupService] Starting database backup');

      // 1. Verify DB reachability
      await this.testConnection();

      // 2. Insert initial log record
      try {
        const [insertResult] = await db.insert(databaseBackupLogs).values({
          filename: finalFilename,
          file_path: finalFilePath,
          backup_type: type,
          status: BACKUP_CONSTANTS.STATUS.IN_PROGRESS,
          triggered_by: String(triggeredBy),
          created_at: new Date(),
        });
        logId = insertResult.insertId;
      } catch (dbLogErr) {
        logger.warn({ err: dbLogErr.message }, '[DatabaseBackupService] Initial log insertion warning');
      }

      // 3. Database Dump
      const dbHost = process.env.DB_HOST || '127.0.0.1';
      const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;
      const dbUser = process.env.DB_USER || 'root';
      const dbPassword = process.env.DB_PASSWORD || '';
      const dbDatabase = process.env.DB_DATABASE || 'kucet_cms';
      const isSsl = process.env.DB_SSL === 'true' || dbHost.includes('tidbcloud.com');

      await mysqldump({
        connection: {
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPassword,
          database: dbDatabase,
          ssl: isSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
        },
        dumpToFile: tempSqlPath,
        dump: {
          schema: {
            table: {
              dropIfExist: true,
            },
          },
          data: {
            maxRowsPerInsertStatement: 500,
          },
        },
      });

      // 4. Validate exported SQL file
      if (!fs.existsSync(tempSqlPath)) {
        throw new Error('mysqldump failed: temporary SQL file was not generated.');
      }
      const rawSize = fs.statSync(tempSqlPath).size;
      if (rawSize < 100) {
        throw new Error(`Exported SQL file is suspiciously small (${rawSize} bytes). Aborting.`);
      }

      // Read sample header to ensure SQL validity
      const sampleBuffer = Buffer.alloc(1024);
      const fd = fs.openSync(tempSqlPath, 'r');
      fs.readSync(fd, sampleBuffer, 0, 1024, 0);
      fs.closeSync(fd);
      const headerStr = sampleBuffer.toString('utf8');
      if (!headerStr.includes('MySQL') && !headerStr.includes('CREATE TABLE') && !headerStr.includes('INSERT INTO') && !headerStr.includes('dump') && !headerStr.includes('Table structure')) {
        throw new Error('Exported SQL file header does not match MySQL dump signature.');
      }

      // 5. Compress to .sql.gz.tmp
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(tempSqlPath);
        const gzipStream = zlib.createGzip({ level: 9 });
        const writeStream = fs.createWriteStream(tempGzPath);

        readStream.pipe(gzipStream).pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        readStream.on('error', reject);
        gzipStream.on('error', reject);
      });

      // Remove raw temporary SQL file
      if (fs.existsSync(tempSqlPath)) {
        fs.unlinkSync(tempSqlPath);
      }

      // 6. Calculate SHA-256 Checksum of compressed backup
      const sha256Checksum = await this.calculateFileSha256(tempGzPath);
      const compressedSize = fs.statSync(tempGzPath).size;

      // 7. Atomic Rename to final backup file
      fs.renameSync(tempGzPath, finalFilePath);

      // Write companion checksum sidecar
      const checksumSidecarPath = `${finalFilePath}.sha256`;
      fs.writeFileSync(checksumSidecarPath, `${sha256Checksum}  ${finalFilename}\n`, { mode: 0o644 });

      // Secure backup file permissions (0600)
      try {
        fs.chmodSync(finalFilePath, 0o600);
      } catch (_e) { /* Windows or fs limitation ignored */ }

      const durationMs = Date.now() - startTime;

      // 8. Retention Pruning (14 days)
      const pruneReport = await this.pruneRetention();

      // 9. Update DB log
      if (logId) {
        try {
          await db.update(databaseBackupLogs).set({
            status: BACKUP_CONSTANTS.STATUS.SUCCESS,
            file_size_bytes: compressedSize,
            checksum_sha256: sha256Checksum,
            duration_ms: durationMs,
            completed_at: new Date(),
          }).where(eq(databaseBackupLogs.id, logId));
        } catch (dbUpdateErr) {
          logger.warn({ err: dbUpdateErr.message }, '[DatabaseBackupService] DB log update warning');
        }
      }

      logger.info({
        finalFilename,
        sizeBytes: compressedSize,
        checksum: sha256Checksum,
        durationMs,
        prunedCount: pruneReport.prunedCount,
      }, '[DatabaseBackupService] Database backup completed successfully');

      return {
        success: true,
        filename: finalFilename,
        filePath: finalFilePath,
        sizeBytes: compressedSize,
        checksum: sha256Checksum,
        durationMs,
        pruneReport,
      };

    } catch (error) {
      logger.error({ err: error.message, finalFilename }, '[DatabaseBackupService] Backup creation failed');

      // Cleanup temporary files
      if (fs.existsSync(tempSqlPath)) {
        try { fs.unlinkSync(tempSqlPath); } catch (_e) { /* ignore */ }
      }
      if (fs.existsSync(tempGzPath)) {
        try { fs.unlinkSync(tempGzPath); } catch (_e) { /* ignore */ }
      }

      // Update log record with failure
      if (logId) {
        try {
          await db.update(databaseBackupLogs).set({
            status: BACKUP_CONSTANTS.STATUS.FAILED,
            error_message: error.message,
            duration_ms: Date.now() - startTime,
            completed_at: new Date(),
          }).where(eq(databaseBackupLogs.id, logId));
        } catch (_e) { /* ignore */ }
      }

      throw error;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Pruning Retention Policy:
   * Retains backups for 14 days only.
   * INVIOLABLE SAFETY: Never deletes the newest/latest valid backup regardless of age.
   */
  static async pruneRetention(retentionDays = BACKUP_CONSTANTS.RETENTION_DAYS) {
    const backupDir = this.getBackupDirectory();
    logger.info({ retentionDays, backupDir }, '[DatabaseBackupService] Evaluating backup retention');

    const files = fs.readdirSync(backupDir)
      .filter(f => (f.endsWith('.sql.gz') || f.endsWith('.sql')) && !f.startsWith('.'))
      .map(filename => {
        const fullPath = path.join(backupDir, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          fullPath,
          size: stats.size,
          mtime: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length <= 1) {
      logger.info('[DatabaseBackupService] Only 0 or 1 backup exists. Skipping retention pruning.');
      return { prunedCount: 0, prunedFiles: [], retainedCount: files.length };
    }

    const cutoffMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const prunedFiles = [];

    // Keep index 0 (newest backup) ALWAYS.
    for (let i = 1; i < files.length; i++) {
      const file = files[i];
      if (file.mtime < cutoffMs) {
        try {
          fs.unlinkSync(file.fullPath);
          const sidecar = `${file.fullPath}.sha256`;
          if (fs.existsSync(sidecar)) {
            fs.unlinkSync(sidecar);
          }
          prunedFiles.push(file.filename);
          logger.info({ filename: file.filename }, '[DatabaseBackupService] Expired backup removed (>14 days)');
        } catch (unlinkErr) {
          logger.warn({ filename: file.filename, err: unlinkErr.message }, '[DatabaseBackupService] Failed to prune backup');
        }
      }
    }

    return {
      prunedCount: prunedFiles.length,
      prunedFiles,
      retainedCount: files.length - prunedFiles.length,
    };
  }

  /**
   * Lists all local backups with checksums and DB log metadata
   */
  static async listBackups() {
    const backupDir = this.getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    // Fetch operational logs from DB
    let dbLogs = [];
    try {
      dbLogs = await db.select().from(databaseBackupLogs).orderBy(desc(databaseBackupLogs.created_at)).limit(100);
    } catch (_e) {
      logger.warn('[DatabaseBackupService] Could not query databaseBackupLogs table');
    }

    const dbLogsMap = new Map();
    dbLogs.forEach(log => {
      dbLogsMap.set(log.filename, log);
    });

    const fileEntries = fs.readdirSync(backupDir)
      .filter(f => (f.endsWith('.sql.gz') || f.endsWith('.sql')) && !f.startsWith('.'))
      .map(filename => {
        const fullPath = path.join(backupDir, filename);
        try {
          const stats = fs.statSync(fullPath);
          const dbLog = dbLogsMap.get(filename);

          // Check if sidecar exists
          let checksum = dbLog?.checksum_sha256 || null;
          const sidecarPath = `${fullPath}.sha256`;
          if (!checksum && fs.existsSync(sidecarPath)) {
            try {
              const content = fs.readFileSync(sidecarPath, 'utf8');
              checksum = content.split(/\s+/)[0];
            } catch (_e) { /* ignore */ }
          }

          const isEmergency = filename.includes('_emergency_pre_restore');
          const backupType = dbLog?.backup_type || (isEmergency ? 'EMERGENCY_PRE_RESTORE' : 'SCHEDULED');

          return {
            name: filename,
            filename,
            size: stats.size,
            created_at: dbLog?.created_at ? new Date(dbLog.created_at).toISOString() : new Date(stats.mtime).toISOString(),
            checksum_sha256: checksum,
            etag: checksum ? checksum.slice(0, 16) : null,
            status: dbLog?.status || 'SUCCESS',
            backup_type: backupType,
            isEmergency,
            duration_ms: dbLog?.duration_ms || null,
          };
        } catch (_err) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return fileEntries;
  }

  /**
   * Restores a database snapshot safely:
   * 1. Validates filename and path
   * 2. Acquires lock
   * 3. Tests archive integrity
   * 4. MANDATORY EMERGENCY BACKUP of live state before restoring
   * 5. Restores dump via MySQL CLI or Node.js multi-statement stream
   * 6. Verifies database tables & integrity
   * 7. Invalidates domain caches
   * 8. Records audit log
   */
  static async restoreBackup({ filename, adminEmail, confirmPhrase }) {
    if (!filename) {
      throw new Error('Filename is required.');
    }

    if (!confirmPhrase || (confirmPhrase !== BACKUP_CONSTANTS.RESTORE_CONFIRM_PHRASE && confirmPhrase !== 'RESTORE_DATABASE')) {
      throw new Error(`Restoration aborted: confirmation phrase must be exactly "${BACKUP_CONSTANTS.RESTORE_CONFIRM_PHRASE}".`);
    }

    // Path traversal guard and strict filename validation
    if (!/^[A-Za-z0-9._-]+\.sql(\.gz)?$/.test(filename)) {
      throw new Error('Invalid backup filename format.');
    }

    const backupDir = this.getBackupDirectory();
    const targetFilePath = path.resolve(backupDir, filename);

    if (!targetFilePath.startsWith(backupDir)) {
      throw new Error('Access denied: Illegal file path.');
    }

    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`Backup file does not exist on disk: ${filename}`);
    }

    this.acquireLock('restore');

    try {
      logger.warn({ filename, adminEmail }, '[DatabaseBackupService] INITIATING GUARDED RESTORE PROCEDURE');

      // 1. Verify archive integrity
      if (filename.endsWith('.gz')) {
        try {
          const buffer = fs.readFileSync(targetFilePath);
          zlib.gunzipSync(buffer.subarray(0, 4096)); // Test first chunk decompression
        } catch (decompErr) {
          throw new Error(`Backup archive is corrupted: ${decompErr.message}`);
        }
      }

      // 2. MANDATORY EMERGENCY PRE-RESTORE BACKUP
      logger.info('[DatabaseBackupService] Creating mandatory emergency pre-restore snapshot of current database...');
      let emergencyResult;
      try {
        // Temporarily release lock for emergency backup call
        this.releaseLock();
        emergencyResult = await this.createBackup({
          triggeredBy: adminEmail || 'SUPER_ADMIN_RESTORE',
          type: BACKUP_CONSTANTS.BACKUP_TYPES.EMERGENCY_PRE_RESTORE,
        });
        this.acquireLock('restore');
      } catch (emergencyErr) {
        this.acquireLock('restore');
        throw new Error(`MANDATORY EMERGENCY BACKUP FAILED: ${emergencyErr.message}. Aborting restoration to prevent data loss.`);
      }

      logger.info({ emergencyBackup: emergencyResult.filename }, '[DatabaseBackupService] Emergency backup secured. Proceeding to restore.');

      // 3. Decompress to temporary file if gzip
      let sqlFilePathToExecute = targetFilePath;
      let tempDecompressedPath = null;

      if (filename.endsWith('.gz')) {
        tempDecompressedPath = path.join(backupDir, `temp_restore_${Date.now()}.sql`);
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(targetFilePath);
          const gunzipStream = zlib.createGunzip();
          const writeStream = fs.createWriteStream(tempDecompressedPath);

          readStream.pipe(gunzipStream).pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          readStream.on('error', reject);
          gunzipStream.on('error', reject);
        });
        sqlFilePathToExecute = tempDecompressedPath;
      }

      // 4. Perform Restore
      await this.executeSqlFile(sqlFilePathToExecute);

      // Clean temporary uncompressed restore file
      if (tempDecompressedPath && fs.existsSync(tempDecompressedPath)) {
        try { fs.unlinkSync(tempDecompressedPath); } catch (_e) { /* ignore */ }
      }

      // 5. Post-Restore Verification
      const tableCount = await this.verifyPostRestore();

      // 6. Invalidate caches
      try {
        await DisasterRecoveryService.rebuildDomainCaches();
      } catch (cacheErr) {
        logger.warn({ err: cacheErr.message }, '[DatabaseBackupService] Domain cache rebuild warning post-restore');
      }

      // 7. Audit Log
      try {
        await db.insert(auditLogs).values({
          user_id: 1,
          user_type: 'admin',
          action: 'DATABASE_RESTORE',
          target_type: 'database',
          target_id: filename,
          payload_after: {
            restoredFilename: filename,
            emergencyBackupFilename: emergencyResult.filename,
            verifiedTables: tableCount,
            restoredBy: adminEmail,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date(),
        });
      } catch (auditErr) {
        logger.warn({ err: auditErr.message }, '[DatabaseBackupService] Audit log insertion warning');
      }

      logger.info({
        restoredFilename: filename,
        emergencyBackup: emergencyResult.filename,
        verifiedTables: tableCount,
      }, '[DatabaseBackupService] RESTORE COMPLETED SUCCESSFULLY');

      return {
        success: true,
        message: `Database successfully restored from ${filename}.`,
        verifiedTables: tableCount,
        emergencyBackupFilename: emergencyResult.filename,
      };

    } finally {
      this.releaseLock();
    }
  }

  /**
   * Executes SQL file into the database with CLI and Node fallback
   */
  static async executeSqlFile(sqlFilePath) {
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbDatabase = process.env.DB_DATABASE || 'kucet_cms';

    // Attempt Native MySQL CLI if present
    const cliSuccess = await new Promise((resolve) => {
      const mysqlArgs = [
        `--host=${dbHost}`,
        `--port=${dbPort}`,
        `--user=${dbUser}`,
        dbDatabase,
      ];

      const mysqlEnv = { ...process.env, MYSQL_PWD: dbPassword };
      if (process.env.DB_SSL === 'true' || dbHost.includes('tidbcloud.com')) {
        mysqlArgs.push('--ssl-mode=REQUIRED');
      }

      const proc = spawn('mysql', mysqlArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: mysqlEnv,
      });

      let errOutput = '';
      proc.stderr.on('data', d => { errOutput += d.toString(); });

      proc.on('error', () => {
        resolve(false); // CLI not found, fallback
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          logger.warn({ code, errOutput }, '[DatabaseBackupService] MySQL CLI execution returned non-zero code. Trying fallback.');
          resolve(false);
        }
      });

      const stream = fs.createReadStream(sqlFilePath);
      stream.pipe(proc.stdin);
    });

    if (cliSuccess) {
      return;
    }

    // Node.js direct execution fallback via mysql2
    logger.info('[DatabaseBackupService] Executing SQL restore via direct Node.js database connection...');
    const conn = await mysql.createConnection({
      host: dbHost === 'db' ? '127.0.0.1' : dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbDatabase,
      multipleStatements: true,
      ssl: (process.env.DB_SSL === 'true' || dbHost.includes('tidbcloud.com')) ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      } : undefined,
    });

    try {
      const fileContent = fs.readFileSync(sqlFilePath, 'utf8');
      // Split into safe chunks of statements
      const statements = fileContent
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      for (const stmt of statements) {
        if (stmt) {
          await conn.query(stmt);
        }
      }
    } finally {
      await conn.end();
    }
  }

  /**
   * Post-restore verification of database tables
   */
  static async verifyPostRestore() {
    const { getDb } = await import('@/lib/db.js');
    const pool = getDb();
    const [rows] = await pool.query('SHOW TABLES');
    const count = Array.isArray(rows) ? rows.length : 0;
    if (count === 0) {
      throw new Error('Post-restore verification failed: no tables found in database.');
    }
    return count;
  }

  /**
   * Returns a streaming response for downloading a backup file
   */
  static getBackupStream(filename) {
    if (!filename || !/^[A-Za-z0-9._-]+\.sql(\.gz)?$/.test(filename)) {
      throw new Error('Invalid backup filename.');
    }

    const backupDir = this.getBackupDirectory();
    const filePath = path.resolve(backupDir, filename);

    if (!filePath.startsWith(backupDir)) {
      throw new Error('Access denied: Illegal file path.');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file not found.');
    }

    const stats = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    return {
      stream,
      size: stats.size,
      filename,
      isGzip: filename.endsWith('.gz'),
    };
  }
}

export default DatabaseBackupService;
