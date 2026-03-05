const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Setting prefix to 'kucet/' to fetch EVERYTHING in the project
const CLOUDINARY_ROOT = 'kucet/';
const LOCAL_BACKUP_DIR = path.join(__dirname, 'cloudinary_backup');

/**
 * Downloads a file from a URL to a local path
 */
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); 
      reject(err);
    });
  });
}

/**
 * Fetches and downloads all resources of a specific type recursively
 */
async function fetchAndDownload(resourceType) {
  console.log(`\n🔍 Searching for all [${resourceType}] resources under '${CLOUDINARY_ROOT}'...`);
  let nextCursor = null;
  let count = 0;
  let skipped = 0;

  do {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: CLOUDINARY_ROOT,
        resource_type: resourceType,
        max_results: 500,
        next_cursor: nextCursor
      });

      for (const resource of result.resources) {
        const relativePath = resource.public_id;
        
        // Append format if it's not already in the public_id
        let fileName = relativePath;
        if (resource.format && !relativePath.toLowerCase().endsWith(`.${resource.format.toLowerCase()}`)) {
          fileName = `${relativePath}.${resource.format}`;
        }

        const fullLocalPath = path.join(LOCAL_BACKUP_DIR, fileName);
        const localDir = path.dirname(fullLocalPath);

        // Recreate the directory structure
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        // --- Skip logic ---
        if (fs.existsSync(fullLocalPath)) {
          console.log(`⏩ Skipping (already exists): ${fileName}`);
          skipped++;
          continue;
        }

        console.log(`📥 [${resourceType}] Downloading: ${fileName}`);
        await downloadFile(resource.secure_url, fullLocalPath);
        count++;
      }

      nextCursor = result.next_cursor;
    } catch (error) {
      console.error(`❌ Error fetching ${resourceType}:`, error.message);
      break;
    }
  } while (nextCursor);

  return { count, skipped };
}

async function runBackup() {
  console.log('🚀 INITIALIZING SMART CLOUDINARY BACKUP (Increment-only)...');
  console.log(`📂 Destination: ${LOCAL_BACKUP_DIR}`);
  
  if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
    fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true });
  }

  try {
    const results = {
      image: await fetchAndDownload('image'),
      video: await fetchAndDownload('video'),
      raw: await fetchAndDownload('raw')
    };

    const totalDownloaded = results.image.count + results.video.count + results.raw.count;
    const totalSkipped = results.image.skipped + results.video.skipped + results.raw.skipped;

    console.log('\n✨ BACKUP PROCESS COMPLETE!');
    console.log(`===========================`);
    console.log(`📥 Total New Downloads: ${totalDownloaded}`);
    console.log(`⏩ Total Files Skipped:  ${totalSkipped}`);
    console.log(`📦 Total Local Assets:  ${totalDownloaded + totalSkipped}`);
    console.log(`===========================`);
  } catch (err) {
    console.error('\n❌ Backup aborted:', err.message);
  }
}

runBackup();
