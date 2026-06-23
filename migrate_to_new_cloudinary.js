const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

/**
 * CLOUDINARY MIGRATION SCRIPT (v4 - Concurrency Optimized)
 * ------------------------------------------------------
 * Uploads assets from 'cloudinary_backup/' to a NEW Cloudinary account.
 * Uses parallel processing for significantly faster migration.
 */

// --- CONFIGURATION ---
const CONCURRENCY_LIMIT = 10; // Number of parallel uploads
const SKIP_EXISTENCE_CHECK = false; 
// ---------------------

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("❌ Error: Cloudinary credentials missing in .env.local");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const BACKUP_DIR = path.join(__dirname, 'cloudinary_backup');

/**
 * Throttler helper to limit concurrency
 */
async function throttledAll(limit, tasks) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

function getAllFiles(dirPath, arrayOfFiles) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

async function migrate() {
  const startTime = Date.now();
  const allFiles = getAllFiles(BACKUP_DIR);
  console.info(`🚀 INITIALIZING FAST MIGRATION: ${allFiles.length} files in queue.`);
  console.info(`🎯 Target Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.info(`⚡ Concurrency: ${CONCURRENCY_LIMIT}\n`);

  let stats = { uploaded: 0, skipped: 0, errors: 0 };

  const tasks = allFiles.map(filePath => async () => {
    const relativePath = path.relative(BACKUP_DIR, filePath).replace(/\\\\/g, '/');
    const ext = path.extname(relativePath);
    const publicId = relativePath.slice(0, -ext.length);
    
    let resourceType = 'image';
    const lowExt = ext.toLowerCase();
    if (['.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.m4a'].includes(lowExt)) {
      resourceType = 'video';
    } else if (['.pdf', '.docx', '.xlsx', '.csv', '.txt'].includes(lowExt)) {
      resourceType = 'raw';
    }

    try {
      if (!SKIP_EXISTENCE_CHECK) {
        try {
          await cloudinary.api.resource(publicId, { resource_type: resourceType });
          console.info(`⏩ Skipping: ${publicId} (Exists)`);
          stats.skipped++;
          return;
        } catch (e) {
          const code = e.http_code || e.error?.http_code;
          const isNotFound = code === 404 || (e.message && e.message.includes('not found'));
          if (!isNotFound) {
            throw new Error(`Check Failed: ${e.message || "Unknown"}`);
          }
        }
      }

      console.info(`📤 Uploading: ${publicId}${ext} ...`);
      const options = {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
        invalidate: true
      };
      if (resourceType === 'raw') options.use_filename = true;

      await cloudinary.uploader.upload(filePath, options);
      stats.uploaded++;
      
    } catch (err) {
      console.error(`❌ Failed: ${publicId} -> ${err.message || "Unknown"}`);
      stats.errors++;
    }
  });

  await throttledAll(CONCURRENCY_LIMIT, tasks);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.info(`\n===========================`);
  console.info(`✨ MIGRATION COMPLETE`);
  console.info(`✅ Newly Uploaded:  ${stats.uploaded}`);
  console.info(`⏩ Already Present: ${stats.skipped}`);
  console.info(`❌ Errors:          ${stats.errors}`);
  console.info(`📦 Total Processed: ${stats.uploaded + stats.skipped + stats.errors}`);
  console.info(`⏱️ Duration:       ${duration}s`);
  console.info(`===========================`);
}

migrate();
