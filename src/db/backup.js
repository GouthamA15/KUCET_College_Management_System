const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');
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
  const backupPath = path.join(process.cwd(), backupFilename);

  console.log(`--- STARTING DATABASE BACKUP [${new Date().toLocaleString()}] ---`);

  try {
    console.log(`Exporting database to ${backupFilename}...`);

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

    // 2. Upload to Cloudinary
    console.log('Uploading to Cloudinary (backups folder)...');
    const result = await cloudinary.uploader.upload(backupPath, {
      folder: 'kucet/backups',
      resource_type: 'raw',
      public_id: backupFilename,
    });

    console.log(`🚀 Backup safely stored at: ${result.secure_url}`);

    // 3. Cleanup local file
    fs.unlinkSync(backupPath);
    console.log('🧹 Local temporary file removed.');
    console.log('--- BACKUP PROCESS COMPLETE ---');

  } catch (error) {
    console.error(`❌ Backup Failed: ${error.message}`);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
}

runBackup();
