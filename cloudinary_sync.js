/**
 * KUCET CMS - Cloudinary Sync Utility
 * 
 * Purpose: 
 * 1. SYNC: Upload all local assets from /public to Cloudinary (kucet/public/ prefix).
 * 2. RESTORE: Download all assets from Cloudinary back to /public.
 * 
 * This ensures that even if the /public folder is deleted, we can repopulate it 
 * instantly from the cloud storage.
 */

const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const https = require('https');
const glob = require('glob');
require('dotenv').config({ path: '.env.local' });

// --- CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_PREFIX = 'kucet/public/';
const LOCAL_PUBLIC_DIR = path.join(__dirname, 'public');

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
 * UPLOADS all files from local /public to Cloudinary
 */
async function syncLocalToCloud() {
  console.info('📤 Syncing local /public assets to Cloudinary...');
  
  // Find all files in public folder recursively
  const files = glob.sync('public/**/*', { nodir: true });
  
  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const relativePath = path.relative('public', file).replace(/\\/g, '/');
    const publicId = `${CLOUDINARY_PREFIX}${relativePath.replace(/\.[^/.]+$/, '')}`;
    
    // Determine resource type
    let resourceType = 'raw'; // Default to raw for safety
    const ext = path.extname(file).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    const videoExts = ['.mp4', '.webm', '.mp3', '.wav', '.ogg'];

    if (imageExts.includes(ext)) {
      resourceType = 'image';
    } else if (videoExts.includes(ext)) {
      resourceType = 'video';
    }

    try {
      console.info(`🚀 Uploading [${resourceType}]: ${relativePath} -> ${publicId}`);
      await cloudinary.uploader.upload(file, {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
        invalidate: true
      });
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to upload ${relativePath}:`, err.message);
      errorCount++;
    }
  }

  console.info(`\n✅ Sync Complete! Success: ${successCount}, Errors: ${errorCount}`);
}

/**
 * RESTORES all files from Cloudinary to local /public
 */
async function restoreCloudToLocal() {
  console.info('📥 Restoring assets from Cloudinary to local /public...');
  
  if (!fs.existsSync(LOCAL_PUBLIC_DIR)) {
    fs.mkdirSync(LOCAL_PUBLIC_DIR, { recursive: true });
  }

  const types = ['image', 'video', 'raw'];
  let totalRestored = 0;

  for (const type of types) {
    let nextCursor = null;
    do {
      try {
        const result = await cloudinary.api.resources({
          type: 'upload',
          prefix: CLOUDINARY_PREFIX,
          resource_type: type,
          max_results: 500,
          next_cursor: nextCursor
        });

        for (const resource of result.resources) {
          const relativePath = resource.public_id.replace(CLOUDINARY_PREFIX, '');
          let fileName = relativePath;
          
          // Append extension for images/videos if missing
          if (type !== 'raw' && resource.format && !relativePath.toLowerCase().endsWith(`.${resource.format.toLowerCase()}`)) {
            fileName = `${relativePath}.${resource.format}`;
          } else if (type === 'raw') {
             // Raw files usually have their extension in the public_id already in Cloudinary 
             // depending on how they were uploaded.
          }

          const fullPath = path.join(LOCAL_PUBLIC_DIR, fileName);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });

          console.info(`✨ Downloading: ${fileName}`);
          await downloadFile(resource.secure_url, fullPath);
          totalRestored++;
        }
        nextCursor = result.next_cursor;
      } catch (err) {
        console.error(`❌ Error fetching ${type}:`, err.message);
        break;
      }
    } while (nextCursor);
  }

  console.info(`\n✅ Restoration Complete! Total files: ${totalRestored}`);
}

// --- CLI ENTRY POINT ---
const action = process.argv[2];

if (action === 'sync') {
  syncLocalToCloud();
} else if (action === 'restore') {
  restoreCloudToLocal();
} else {
  console.info(`
KUCET Cloudinary Sync Tool
--------------------------
Usage: 
  node cloudinary_sync.js sync     - Uploads local /public files to Cloudinary
  node cloudinary_sync.js restore  - Downloads Cloudinary files back to /public
  `);
}
