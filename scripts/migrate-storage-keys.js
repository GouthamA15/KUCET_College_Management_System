#!/usr/bin/env node
/**
 * ============================================================
 * STORAGE KEY MIGRATION SCRIPT
 * ============================================================
 * Normalizes all image columns in the database from
 * provider-specific URLs back to canonical storage keys.
 *
 * Converts:
 *   https://res.cloudinary.com/CLOUD/image/upload/f_auto,q_auto/kucet/students/pfp/abc.jpg
 *   v1778497250/kucet/students/pfp/abc.jpg
 *   https://bucket.s3.amazonaws.com/kucet/students/pfp/abc.jpg
 *   [object Object].webp
 * To:
 *   kucet/students/pfp/abc.jpg
 *
 * IDEMPOTENT: Running twice produces the same result.
 * SAFE: Never overwrites a value that is already a valid storage key.
 * ============================================================
 */

import 'dotenv/config';
import { createConnection } from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

/**
 * Converts any value to a canonical storage key.
 * Returns null if the value cannot be normalized (e.g., [object Object]).
 * Returns the original value if it's already a valid storage key.
 * @param {string|null} value
 * @returns {string|null}
 */
function toStorageKey(value) {
  if (!value || typeof value !== 'string') return value;

  // 1. Already a valid storage key (relative path starting with kucet/ or archive/)
  if (
    (value.startsWith('kucet/') || value.startsWith('archive/')) &&
    !value.includes('://') &&
    !value.startsWith('[object')
  ) {
    return value; // Already correct, skip
  }

  // 2. Detect and fix [object Object] corruption
  if (value.includes('[object Object]') || value.startsWith('[object')) {
    console.warn(`  [CORRUPT] Cannot recover "[object Object]" value: ${value.substring(0, 80)}`);
    return null; // Cannot safely recover; nullify rather than store garbage
  }

  // 3. Cloudinary URL with transformations:
  // https://res.cloudinary.com/CLOUD/image/upload/f_auto,q_auto/v123456/kucet/...
  if (value.includes('cloudinary.com')) {
    const uploadParts = value.split('/upload/');
    if (uploadParts.length >= 2) {
      let path = uploadParts[1];
      // Strip version prefix (v1234567/)
      path = path.replace(/^v\d+\//, '');
      // Strip transformation prefix (f_auto,q_auto/ or w_500,h_500,c_fill/)
      // Cloudinary transformations ALWAYS contain commas (e.g., f_auto,q_auto)
      // They never start with 'kucet' or 'archive'
      const segments = path.split('/');
      const looksLikeTransform = segments.length > 1 && 
        segments[0].includes(',') && 
        !segments[0].includes('.');
      if (looksLikeTransform) {
        path = segments.slice(1).join('/');
      }
      // Strip version again in case it appeared after transformations
      path = path.replace(/^v\d+\//, '');
      
      if (path && (path.startsWith('kucet/') || path.startsWith('archive/'))) {
        return path;
      }
    }
    return null; // Cannot parse Cloudinary URL safely
  }

  // 4. Versioned Cloudinary path without domain (v1234567/kucet/...)
  if (/^v\d+\/kucet\//.test(value) || /^v\d+\/archive\//.test(value)) {
    return value.replace(/^v\d+\//, '');
  }

  // 5. Amazon S3 URL: https://bucket.s3.amazonaws.com/kucet/...
  if (value.includes('amazonaws.com')) {
    const match = value.match(/amazonaws\.com\/(.+)$/);
    if (match) {
      const path = match[1];
      if (path.startsWith('kucet/') || path.startsWith('archive/')) {
        return path;
      }
    }
    return null;
  }

  // 6. Local /api/assets/view/ URL
  if (value.startsWith('/api/assets/view/')) {
    return value.replace('/api/assets/view/', '');
  }

  // 7. Data URIs cannot be stored as storage keys
  if (value.startsWith('data:')) {
    console.warn(`  [SKIP] Data URI found in DB (cannot migrate): ${value.substring(0, 40)}...`);
    return value; // Leave as-is; data URIs shouldn't be in DB but don't corrupt them
  }

  // 8. Unknown format - leave as-is to avoid data loss
  console.warn(`  [UNKNOWN FORMAT] Cannot normalize: ${value.substring(0, 80)}`);
  return value;
}

/**
 * Describes all image columns to migrate.
 * Format: { table, column, pk }
 */
const IMAGE_COLUMNS = [
  // student_images
  { table: 'student_images', column: 'pfp', pk: 'student_id' },
  // student_signatures
  { table: 'student_signatures', column: 'signature', pk: 'student_id' },
  // student_profile_requests
  { table: 'student_profile_requests', column: 'new_signature', pk: 'id' },
  { table: 'student_profile_requests', column: 'new_pfp', pk: 'id' },
  { table: 'student_profile_requests', column: 'proof_url', pk: 'id' },
  // student_admission_drafts
  { table: 'student_admission_drafts', column: 'pfp', pk: 'id' },
  { table: 'student_admission_drafts', column: 'signature', pk: 'id' },
  // staff_accounts (Session 207+)
  { table: 'staff_accounts', column: 'pfp', pk: 'id' },
  { table: 'staff_accounts', column: 'signature', pk: 'id' },
  // staff_registration_requests (Session 207+)
  { table: 'staff_registration_requests', column: 'pfp', pk: 'id' },
  { table: 'staff_registration_requests', column: 'signature', pk: 'id' },
  // clerks (legacy)
  { table: 'clerks', column: 'pfp', pk: 'id' },
  { table: 'clerks', column: 'signature', pk: 'id' },
  // student_requests (payment screenshots)
  { table: 'student_requests', column: 'payment_screenshot', pk: 'request_id' },
  // student_request_images
  { table: 'student_request_images', column: 'payment_screenshot', pk: 'request_id' },
  // bug_reports
  { table: 'bug_reports', column: 'screenshot_url', pk: 'id' },
  // archive tables
  { table: 'archive_students', column: 'pfp', pk: 'id' },
  { table: 'archive_student_personal_details', column: 'signature_path', pk: 'id' },
  { table: 'archive_student_payments', column: 'payment_screenshot_path', pk: 'id' },
];

async function migrateTable(conn, { table, column, pk }) {
  // Check if table exists
  const [tables] = await conn.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  if (tables.length === 0) {
    console.info(`  [SKIP] Table ${table} does not exist yet`);
    return { checked: 0, migrated: 0, nullified: 0, skipped: 0 };
  }

  // Check if column exists
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (cols.length === 0) {
    console.info(`  [SKIP] Column ${table}.${column} does not exist`);
    return { checked: 0, migrated: 0, nullified: 0, skipped: 0 };
  }

  const [rows] = await conn.execute(
    `SELECT \`${pk}\`, \`${column}\` FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`
  );

  let migrated = 0;
  let nullified = 0;
  let skipped = 0;

  for (const row of rows) {
    const original = row[column];
    const normalized = toStorageKey(original);

    if (normalized === original) {
      skipped++; // Already correct or unknown format (left as-is)
      continue;
    }

    // Update the row
    await conn.execute(
      `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${pk}\` = ?`,
      [normalized, row[pk]]
    );

    if (normalized === null) {
      nullified++;
      console.info(`  [NULLIFIED] ${table}.${column} for ${pk}=${row[pk]}: "${original.substring(0, 60)}..."`);
    } else {
      migrated++;
      if (migrated <= 5) { // Only log first 5 to avoid spam
        console.info(`  [MIGRATED] ${table}.${column}: "${original.substring(0, 50)}" → "${normalized}"`);
      }
    }
  }

  return { checked: rows.length, migrated, nullified, skipped };
}

async function main() {
  console.info('='.repeat(60));
  console.info('KUCET Storage Key Migration');
  console.info('='.repeat(60));
  console.info('This script normalizes all image columns to storage keys.');
  console.info('It is IDEMPOTENT - safe to run multiple times.');
  console.info('');

  let conn;
  try {
    conn = await createConnection(DB_CONFIG);
    console.info('✓ Connected to database\n');

    let totalChecked = 0;
    let totalMigrated = 0;
    let totalNullified = 0;

    for (const colDef of IMAGE_COLUMNS) {
      process.stdout.write(`Processing ${colDef.table}.${colDef.column}... `);
      const result = await migrateTable(conn, colDef);
      console.info(`done (checked: ${result.checked}, migrated: ${result.migrated}, nullified: ${result.nullified}, skipped: ${result.skipped})`);
      totalChecked += result.checked;
      totalMigrated += result.migrated;
      totalNullified += result.nullified;
    }

    console.info('');
    console.info('='.repeat(60));
    console.info('MIGRATION COMPLETE');
    console.info(`Total rows checked:   ${totalChecked}`);
    console.info(`Total rows migrated:  ${totalMigrated}`);
    console.info(`Total rows nullified: ${totalNullified} (unrecoverable [object Object])`);
    console.info('='.repeat(60));

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
