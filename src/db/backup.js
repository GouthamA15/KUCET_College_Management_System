const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `kucet_db_backup_${timestamp}.sql`;
  // Use os.tmpdir() for better security and hygiene
  const backupPath = path.join(os.tmpdir(), backupFilename);

  console.log(`--- STARTING DATABASE BACKUP [${new Date().toLocaleString()}] ---`);

  try {
    console.log(`Exporting database to temporary directory: ${backupPath}...`);

    // 1. Run Pure Node Dump
    await mysqldump({
      connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: parseInt(process.env.DB_PORT) || 3306,
        ssl: (process.env.DB_SSL === 'true' || process.env.DB_HOST.includes('tidbcloud.com')) 
             ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } 
             : undefined
      },
      dumpToFile: backupPath,
    });

    console.log(`✅ Export complete. Size: ${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB`);

    // 2. Upload to Cloudinary with restricted access mode
    console.log('Uploading to Cloudinary (backups folder)...');
    const result = await cloudinary.uploader.upload(backupPath, {
      folder: 'kucet/backups',
      resource_type: 'raw',
      public_id: backupFilename,
      access_mode: 'authenticated', // Prevents public access via URL; requires signed URL or Auth header
    });

    console.log(`🚀 Backup safely stored at: ${result.secure_url}`);

  } catch (error) {
    console.error(`❌ Backup Failed: ${error.message}`);
  } finally {
    // 3. Cleanup local file (Always ensure cleanup in finally block)
    if (fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
        console.log('Sweep: Local temporary file removed.');
      } catch (cleanupErr) {
        console.warn(`🧹 Warning: Failed to remove temp file: ${cleanupErr.message}`);
      }
    }
    console.log('--- BACKUP PROCESS COMPLETE ---');
  }
}

runBackup();
