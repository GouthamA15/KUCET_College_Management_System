#!/usr/bin/env node
/**
 * ============================================================
 * BIDIRECTIONAL STORAGE SYNCHRONIZATION TOOL
 * ============================================================
 * Syncs media files between Cloudinary and Local VPS disk storage.
 *
 * Usage:
 *   node scripts/sync-storage.mjs --from=cloudinary --to=local
 *   node scripts/sync-storage.mjs --from=local --to=cloudinary
 *
 * Flags:
 *   --dry-run       Preview operations without downloading/uploading
 *   --concurrency=N Max parallel network operations (default: 5)
 *   --force         Overwrite destination files even if they already exist
 * ============================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { createConnection } from 'mysql2/promise';

// Initialize Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

function getLocalBasePath() {
  if (process.env.LOCAL_STORAGE_PATH) {
    return process.env.LOCAL_STORAGE_PATH;
  }
  return path.join(process.cwd(), 'public', 'uploads');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    from: null,
    to: null,
    dryRun: false,
    concurrency: 5,
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--from=')) options.from = arg.split('=')[1].toLowerCase();
    if (arg.startsWith('--to=')) options.to = arg.split('=')[1].toLowerCase();
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--force') options.force = true;
    if (arg.startsWith('--concurrency=')) options.concurrency = parseInt(arg.split('=')[1], 10) || 5;
  }

  return options;
}

/**
 * Discovers storage keys recorded in the application database tables
 */
async function getDbStorageKeys() {
  let conn;
  const keys = new Set();

  try {
    conn = await createConnection(DB_CONFIG);
    const tablesAndCols = [
      { table: 'student_images', col: 'pfp' },
      { table: 'student_signatures', col: 'signature' },
      { table: 'student_admission_drafts', col: 'pfp' },
      { table: 'student_admission_drafts', col: 'signature' },
      { table: 'student_profile_requests', col: 'new_pfp' },
      { table: 'student_profile_requests', col: 'new_signature' },
      { table: 'student_profile_requests', col: 'proof_url' },
      { table: 'student_requests', col: 'payment_screenshot' },
      { table: 'student_request_images', col: 'payment_screenshot' },
      { table: 'staff_accounts', col: 'pfp' },
      { table: 'staff_accounts', col: 'signature' },
      { table: 'staff_registration_requests', col: 'pfp' },
      { table: 'staff_registration_requests', col: 'signature' },
      { table: 'bug_reports', col: 'screenshot_url' },
      { table: 'archive_students', col: 'pfp' },
      { table: 'archive_student_personal_details', col: 'signature_path' },
      { table: 'archive_student_payments', col: 'payment_screenshot_path' },
    ];

    for (const { table, col } of tablesAndCols) {
      try {
        const [rows] = await conn.execute(
          `SELECT \`${col}\` AS val FROM \`${table}\` WHERE \`${col}\` IS NOT NULL`
        );
        for (const row of rows) {
          const val = row.val;
          if (val && typeof val === 'string' && !val.startsWith('data:') && !val.includes('[object')) {
            let clean = val;
            if (clean.includes('/api/assets/view/')) clean = clean.split('/api/assets/view/')[1];
            if (clean.includes('cloudinary.com')) {
              const parts = clean.split('/upload/');
              if (parts.length > 1) clean = parts[1].replace(/^v\d+\//, '');
            }
            clean = clean.replace(/^[/\\]+/, '');
            if (clean) keys.add(clean);
          }
        }
      } catch (_e) {
        // Table or column might not exist yet
      }
    }
  } catch (err) {
    console.warn('Database inspection warning:', err.message);
  } finally {
    if (conn) await conn.end();
  }

  return Array.from(keys);
}

/**
 * Downloads a remote URL to local file path
 */
async function downloadFile(url, destPath) {
  const dir = path.dirname(destPath);
  await fs.promises.mkdir(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(destPath, buffer);
  return buffer.length;
}

/**
 * Recursively scans directory for all files
 */
async function scanLocalFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanLocalFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

/**
 * CLOUDINARY -> LOCAL SYNCHRONIZATION
 */
async function syncCloudinaryToLocal(options) {
  console.info('\n🚀 Starting Cloudinary → Local Storage Sync...');
  const basePath = getLocalBasePath();
  console.info(`📁 Target Local Base Path: ${basePath}`);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME is required');
  }

  // 1. Collect keys from DB
  const dbKeys = await getDbStorageKeys();
  console.info(`📋 Discovered ${dbKeys.length} active storage keys in database`);

  // 2. Fetch all assets from Cloudinary Search API if credentials present
  const cloudinaryKeys = new Set(dbKeys);
  try {
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      console.info('🔍 Querying Cloudinary Search API for kucet* assets...');
      let nextCursor = null;
      do {
        const query = cloudinary.search
          .expression('public_id:kucet* OR folder:kucet*')
          .max_results(500);
        if (nextCursor) query.next_cursor(nextCursor);
        const result = await query.execute();

        for (const resource of result.resources || []) {
          const ext = resource.format ? `.${resource.format}` : '';
          cloudinaryKeys.add(`${resource.public_id}${ext}`);
        }
        nextCursor = result.next_cursor;
      } while (nextCursor);
    }
  } catch (err) {
    console.warn(`⚠️ Cloudinary search API notice (${err.message}). Using database keys.`);
  }

  const allKeys = Array.from(cloudinaryKeys);
  console.info(`📦 Total assets to sync: ${allKeys.length}`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of allKeys) {
    const cleanKey = key.replace(/^\/+/, '');
    const localDest = basePath.endsWith('kucet')
      ? path.join(basePath, cleanKey.replace(/^kucet\//, ''))
      : path.join(basePath, cleanKey.startsWith('kucet') ? cleanKey : `kucet/${cleanKey}`);

    if (!options.force && fs.existsSync(localDest)) {
      skipped++;
      continue;
    }

    if (options.dryRun) {
      console.info(`[DRY-RUN] Would download: ${cleanKey} -> ${localDest}`);
      downloaded++;
      continue;
    }

    try {
      const ext = cleanKey.split('.').pop()?.toLowerCase() || '';
      let resourceType = 'image';
      if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(ext)) resourceType = 'video';
      else if (['pdf', 'docx', 'xlsx', 'csv'].includes(ext)) resourceType = 'raw';

      const downloadUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${cleanKey}`;
      process.stdout.write(`Downloading ${cleanKey}... `);
      const bytes = await downloadFile(downloadUrl, localDest);
      console.info(`✓ (${(bytes / 1024).toFixed(1)} KB)`);
      downloaded++;
    } catch (err) {
      console.info(`✗ (${err.message})`);
      failed++;
    }
  }

  console.info('\n' + '='.repeat(50));
  console.info('🎉 Cloudinary → Local Sync Complete');
  console.info(`Downloaded: ${downloaded}`);
  console.info(`Skipped:    ${skipped}`);
  console.info(`Failed:     ${failed}`);
  console.info('='.repeat(50));
}

/**
 * LOCAL -> CLOUDINARY SYNCHRONIZATION
 */
async function syncLocalToCloudinary(options) {
  console.info('\n🚀 Starting Local → Cloudinary Storage Sync...');
  const basePath = getLocalBasePath();
  console.info(`📁 Source Local Base Path: ${basePath}`);

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required for uploading');
  }

  const localFiles = await scanLocalFiles(basePath);
  console.info(`🔍 Found ${localFiles.length} local files on disk`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of localFiles) {
    const relFromBase = path.relative(basePath, filePath).replace(/\\/g, '/');
    const cleanKey = (relFromBase.startsWith('kucet/') || basePath.endsWith('kucet'))
      ? (relFromBase.startsWith('kucet/') ? relFromBase : `kucet/${relFromBase}`)
      : `kucet/${relFromBase}`;

    const folder = path.dirname(cleanKey);
    const filename = path.basename(cleanKey);
    const lastDot = filename.lastIndexOf('.');
    const publicId = lastDot > 0 ? filename.substring(0, lastDot) : filename;

    if (options.dryRun) {
      console.info(`[DRY-RUN] Would upload: ${filePath} -> Cloudinary ${folder}/${publicId}`);
      uploaded++;
      continue;
    }

    try {
      process.stdout.write(`Uploading ${cleanKey}... `);
      await cloudinary.uploader.upload(filePath, {
        folder: folder,
        public_id: publicId,
        resource_type: 'auto',
        overwrite: options.force,
      });
      console.info('✓');
      uploaded++;
    } catch (err) {
      console.info(`✗ (${err.message})`);
      failed++;
    }
  }

  console.info('\n' + '='.repeat(50));
  console.info('🎉 Local → Cloudinary Sync Complete');
  console.info(`Uploaded: ${uploaded}`);
  console.info(`Skipped:  ${skipped}`);
  console.info(`Failed:   ${failed}`);
  console.info('='.repeat(50));
}

async function main() {
  const options = parseArgs();

  if (!options.from || !options.to) {
    console.info(`
KUCET CMS Storage Synchronization Tool

Usage:
  node scripts/sync-storage.mjs --from=cloudinary --to=local
  node scripts/sync-storage.mjs --from=local --to=cloudinary

Options:
  --dry-run      Preview actions without modifying files
  --force        Overwrite destination files if they exist
  --concurrency  Max parallel transfers
`);
    process.exit(1);
  }

  try {
    if (options.from === 'cloudinary' && options.to === 'local') {
      await syncCloudinaryToLocal(options);
    } else if (options.from === 'local' && options.to === 'cloudinary') {
      await syncLocalToCloudinary(options);
    } else {
      console.error(`Unsupported synchronization direction: ${options.from} -> ${options.to}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Sync Error:', err.message);
    process.exit(1);
  }
}

main();
