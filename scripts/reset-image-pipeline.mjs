/**
 * ============================================================
 * PHASE 1 + 2: Cloudinary Bulk Delete + Database Reset Script
 * ============================================================
 * Run with: node scripts/reset-image-pipeline.mjs
 *
 * Phase 1: Delete all project images from Cloudinary
 *   - Root-level folders: students/, requests/, clerks/,
 *     admission_drafts/, certificates/, bug_reports/, test/
 *   - kucet/ sub-tree (excluding kucet/institution/)
 *
 * Phase 2: Reset all image columns in database to NULL
 *
 * IMPORTANT: This is a one-way destructive operation.
 * Make sure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET, and DB_* env vars are set.
 * ============================================================
 */

import { v2 as cloudinary } from 'cloudinary';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ============================================================
// CLOUDINARY CONFIG
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ============================================================
// FOLDERS TO DELETE
// ============================================================
const ROOT_FOLDERS_TO_DELETE = [
  'students',
  'requests',
  'clerks',
  'admission_drafts',
  'certificates',
  'bug_reports',
  'test',
];

// Under kucet/ we delete all EXCEPT kucet/institution/
const KUCET_SUBFOLDERS_TO_DELETE = [
  'kucet/students',
  'kucet/requests',
  'kucet/clerks',
  'kucet/admission_drafts',
  'kucet/certificates',
  'kucet/bug_reports',
  'kucet/test',
];

// ============================================================
// Helper: Delete all assets in a Cloudinary folder
// ============================================================
async function deleteCloudinaryFolder(folderPath) {
  console.info(`\n[CLOUDINARY] Deleting assets in folder: ${folderPath}`);
  let deleted = 0;
  let nextCursor = undefined;

  do {
    const params = {
      type: 'upload',
      prefix: `${folderPath}/`,
      max_results: 500,
    };
    if (nextCursor) params.next_cursor = nextCursor;

    let resources;
    try {
      const result = await cloudinary.api.resources(params);
      resources = result.resources || [];
      nextCursor = result.next_cursor;
    } catch (err) {
      if (err.error?.message?.includes('not found') || err.http_code === 404) {
        console.info(`  [SKIP] Folder ${folderPath}/ not found on Cloudinary.`);
        return 0;
      }
      throw err;
    }

    if (resources.length === 0) break;

    const publicIds = resources.map(r => r.public_id);
    await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
    deleted += publicIds.length;
    console.info(`  Deleted ${publicIds.length} assets. (total: ${deleted})`);
  } while (nextCursor);

  // Delete the folder itself (Cloudinary API)
  try {
    await cloudinary.api.delete_folder(folderPath);
    console.info(`  [FOLDER] Deleted folder: ${folderPath}`);
  } catch (e) {
    console.warn(`  [WARN] Could not delete empty folder ${folderPath}: ${e.message}`);
  }

  return deleted;
}

// ============================================================
// PHASE 1: Cloudinary Cleanup
// ============================================================
async function cloudinaryCleanup() {
  console.info('\n========================================');
  console.info('PHASE 1: Cloudinary Cleanup');
  console.info('========================================');

  let totalDeleted = 0;

  for (const folder of ROOT_FOLDERS_TO_DELETE) {
    totalDeleted += await deleteCloudinaryFolder(folder);
  }

  for (const folder of KUCET_SUBFOLDERS_TO_DELETE) {
    totalDeleted += await deleteCloudinaryFolder(folder);
  }

  console.info(`\n[CLOUDINARY] Total assets deleted: ${totalDeleted}`);
  return totalDeleted;
}

// ============================================================
// PHASE 2: Database Cleanup
// ============================================================
async function databaseCleanup() {
  console.info('\n========================================');
  console.info('PHASE 2: Database Reset of Image Columns');
  console.info('========================================');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });

  const statements = [
    // student_images: clear pfp
    { sql: 'DELETE FROM student_images', label: 'student_images (all rows)' },

    // student_signatures: clear signature
    { sql: 'DELETE FROM student_signatures', label: 'student_signatures (all rows)' },

    // student_profile_requests: clear image fields for pending requests
    {
      sql: "UPDATE student_profile_requests SET new_signature = NULL, new_pfp = NULL, proof_url = NULL WHERE status = 'pending'",
      label: 'student_profile_requests (pending image fields)'
    },
    // Clear approved/rejected too since Cloudinary images are gone
    {
      sql: 'UPDATE student_profile_requests SET new_signature = NULL, new_pfp = NULL, proof_url = NULL',
      label: 'student_profile_requests (all image fields)'
    },

    // student_admission_drafts: clear pfp + signature
    {
      sql: 'UPDATE student_admission_drafts SET pfp = NULL, signature = NULL',
      label: 'student_admission_drafts.pfp + signature'
    },

    // clerks: clear pfp + signature
    {
      sql: 'UPDATE clerks SET pfp = NULL, signature = NULL',
      label: 'clerks.pfp + signature'
    },

    // student_requests (certificate): clear payment_screenshot
    {
      sql: 'UPDATE student_requests SET payment_screenshot = NULL',
      label: 'student_requests.payment_screenshot'
    },

    // student_request_images: clear payment_screenshot
    {
      sql: 'DELETE FROM student_request_images',
      label: 'student_request_images (all rows)'
    },

    // bug_reports: clear screenshot_url
    {
      sql: 'UPDATE bug_reports SET screenshot_url = NULL',
      label: 'bug_reports.screenshot_url'
    },
  ];

  for (const { sql, label } of statements) {
    try {
      const [result] = await conn.execute(sql);
      const affected = result.affectedRows ?? '?';
      console.info(`  [DB] ${label}: ${affected} rows affected`);
    } catch (err) {
      console.warn(`  [DB WARN] ${label}: ${err.message}`);
    }
  }

  await conn.end();
  console.info('\n[DB] Database image columns reset complete.');
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.info('===========================================');
  console.info('IMAGE PIPELINE RESET SCRIPT');
  console.info('===========================================');
  console.info('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || '(NOT SET)');
  console.info('DB Host:   ', process.env.DB_HOST || '(NOT SET)');
  console.info('');

  const cloudDeletedCount = await cloudinaryCleanup();
  await databaseCleanup();

  console.info('\n===========================================');
  console.info('RESET COMPLETE');
  console.info(`Cloudinary assets deleted: ${cloudDeletedCount}`);
  console.info('Database image columns cleared.');
  console.info('===========================================');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
