const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

/**
 * SMART & FAST CLOUDINARY ASSET FETCH (v2 - Concurrency Optimized)
 * ---------------------------------------------------------------
 * Uses parallel downloads to maximize throughput.
 */

const CONCURRENCY_LIMIT = 15; // Number of parallel downloads

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_ROOT = 'kucet/';
const LOCAL_BACKUP_DIR = path.join(__dirname, 'cloudinary_backup');

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

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => { /* empty */ }); 
      reject(err);
    });
  });
}

async function fetchAndDownload(resourceType) {
  console.info(`\n🔍 Scanning [${resourceType}]...`);
  let nextCursor = null;
  let stats = { downloaded: 0, skipped: 0, folders: { /* empty */ } };

  do {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: CLOUDINARY_ROOT,
        resource_type: resourceType,
        max_results: 500,
        next_cursor: nextCursor
      });

      const tasks = result.resources.map(resource => async () => {
        const publicId = resource.public_id;
        const format = resource.format || 'jpg';
        const fileName = publicId.toLowerCase().endsWith(`.${format}`) ? publicId : `${publicId}.${format}`;
        
        const fullLocalPath = path.join(LOCAL_BACKUP_DIR, fileName);
        const folderName = path.dirname(fileName);
        
        // Synchronous stats tracking
        stats.folders[folderName] = (stats.folders[folderName] || 0) + 1;

        if (fs.existsSync(fullLocalPath)) {
          stats.skipped++;
          return;
        }

        if (!fs.existsSync(path.dirname(fullLocalPath))) {
          fs.mkdirSync(path.dirname(fullLocalPath), { recursive: true });
        }

        try {
          await downloadFile(resource.secure_url, fullLocalPath);
          console.info(`✅ OK: ${fileName}`);
          stats.downloaded++;
        } catch (e) {
          console.error(`❌ FAIL: ${fileName} (${e.message})`);
        }
      });

      await throttledAll(CONCURRENCY_LIMIT, tasks);
      nextCursor = result.next_cursor;
    } catch (error) {
      console.error(`💥 API Error: ${error.message}`);
      break;
    }
  } while (nextCursor);

  return stats;
}

async function run() {
  const startTime = Date.now();
  console.info('🚀 STARTING CONCURRENCY-OPTIMIZED ASSET FETCH...');
  if (!fs.existsSync(LOCAL_BACKUP_DIR)) fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true });

  const imgStats = await fetchAndDownload('image');
  const vidStats = await fetchAndDownload('video');
  const rawStats = await fetchAndDownload('raw');

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.info('\n===========================================');
  console.info('📊 DOWNLOAD SUMMARY BY FOLDER');
  console.info('===========================================');
  
  const allFolders = {...imgStats.folders, ...vidStats.folders, ...rawStats.folders};
  Object.keys(allFolders).sort().forEach(folder => {
    console.info(`📁 ${folder.padEnd(45)} : ${allFolders[folder]} files`);
  });

  const total = imgStats.downloaded + vidStats.downloaded + rawStats.downloaded;
  const skipped = imgStats.skipped + vidStats.skipped + rawStats.skipped;
  
  console.info('-------------------------------------------');
  console.info(`✨ New Downloads : ${total}`);
  console.info(`⏩ Already Local : ${skipped}`);
  console.info(`📦 Grand Total   : ${total + skipped}`);
  console.info(`⏱️ Duration      : ${duration}s`);
  console.info('===========================================');
}

run();
