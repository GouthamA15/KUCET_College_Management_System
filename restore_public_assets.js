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

const CLOUDINARY_PREFIX = 'kucet/public/';
const LOCAL_TARGET = path.join(__dirname, 'public');

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
      fs.unlink(dest, () => {}); // Delete temp file
      reject(err);
    });
  });
}

/**
 * Fetches and downloads all resources of a specific type
 */
async function fetchAndDownload(resourceType) {
  console.log(`\n📂 Scanning Cloudinary for [${resourceType}] files...`);
  let nextCursor = null;
  let count = 0;

  do {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: CLOUDINARY_PREFIX,
        resource_type: resourceType,
        max_results: 500,
        next_cursor: nextCursor
      });

      for (const resource of result.resources) {
        // Map Cloudinary public_id to local path
        // Example: 'kucet/public/assets/DevPics/Dev1' -> 'assets/DevPics/Dev1'
        const relativePath = resource.public_id.replace(CLOUDINARY_PREFIX, '');
        
        // Handle extensions: 
        // Images/Videos in Cloudinary often don't have the extension in the public_id
        // but it's required locally.
        let fileName = relativePath;
        if (resource.format && !relativePath.toLowerCase().endsWith(`.${resource.format.toLowerCase()}`)) {
          fileName = `${relativePath}.${resource.format}`;
        }

        const fullLocalPath = path.join(LOCAL_TARGET, fileName);
        const localDir = path.dirname(fullLocalPath);

        // Ensure directory exists
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        console.log(`🚀 Downloading: ${fileName}`);
        await downloadFile(resource.secure_url, fullLocalPath);
        count++;
      }

      nextCursor = result.next_cursor;
    } catch (error) {
      console.error(`❌ Error fetching ${resourceType}:`, error.message);
      break;
    }
  } while (nextCursor);

  return count;
}

async function restore() {
  console.log('🏗️ Starting Asset Restoration from Cloudinary...');
  
  if (!fs.existsSync(LOCAL_TARGET)) {
    fs.mkdirSync(LOCAL_TARGET, { recursive: true });
  }

  try {
    const imageCount = await fetchAndDownload('image');
    const videoCount = await fetchAndDownload('video'); // Cloudinary treats Audio as Video type
    const rawCount = await fetchAndDownload('raw');     // PDFs, CSVs, etc.

    console.log('\n✨ Restoration Complete!');
    console.log(`------------------------`);
    console.log(`📸 Images: ${imageCount}`);
    console.log(`🎵 Audio/Video: ${videoCount}`);
    console.log(`📄 Raw Files: ${rawCount}`);
    console.log(`✅ Total: ${imageCount + videoCount + rawCount} files restored to /public folder.`);
  } catch (err) {
    console.error('\n💥 Critical failure:', err.message);
  }
}

restore();
