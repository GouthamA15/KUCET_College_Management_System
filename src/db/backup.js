const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
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

const DEVELOPER_EMAILS = [
  "sunnysunnit@gmail.com",
  "testersybau67@gmail.com",
  "uzair.mdf@gmail.com"
];

/**
 * Sends failure email to developers via Brevo API
 */
async function sendFailureEmail(errorMessage) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey || !senderEmail) {
    console.warn('[BACKUP_EMAIL] Brevo configuration missing. Skipping email notification.');
    return;
  }

  console.info(`Sending failure alerts to ${DEVELOPER_EMAILS.length} developers...`);

  try {
    const payload = {
      sender: { email: senderEmail, name: 'KUCET Backup System' },
      to: DEVELOPER_EMAILS.map(email => ({ email })),
      subject: '❌ URGENT: KUCET Database Backup Failed',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #b91c1c;">Database Backup Failure</h2>
          <p>The daily automated database backup for <strong>KUCET College Management System</strong> has failed.</p>
          <div style="background: #fee2e2; border: 1px solid #f87171; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Error Message:</strong><br/>
            <code style="color: #b91c1c;">${errorMessage}</code>
          </div>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p>Please check the GitHub Actions logs immediately to diagnose and resolve the issue.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated system alert.</p>
        </div>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.info('✅ Failure emails sent successfully.');
    } else {
      const data = await response.json();
      console.error('❌ Failed to send failure emails:', data);
    }
  } catch (error) {
    console.error('❌ Exception sending failure emails:', error.message);
  }
}

/**
 * Calculates MD5 hash of a file
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Pruning Retention Policy Implementation
 * Keeps: 30 daily, 4 weekly (Sundays), 12 monthly (1st of month)
 */
async function pruneBackups() {
  console.info('--- STARTING RETENTION PRUNING ---');
  try {
    // List all backup files in the folder
    const result = await cloudinary.api.resources_by_asset_folder('kucet/backups', {
      resource_type: 'raw',
      max_results: 500, // Safe limit for typical retention
    });

    const backups = result.resources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    console.info(`Found ${backups.length} total backups in Cloudinary.`);

    const toKeep = new Set();
    const now = new Date();

    backups.forEach((b) => {
      const date = new Date(b.created_at);
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      const isSunday = date.getDay() === 0;
      const isFirstOfMonth = date.getDate() === 1;

      // 1. Keep ALL for last 30 days
      if (diffDays <= 30) {
        toKeep.add(b.public_id);
      }
      // 2. Keep Sundays for last 90 days (approx 13 weeks) - we keep 4 weekly as requested
      // Actually keeping 4 weekly means we keep Sundays for the last 28 days
      else if (isSunday && diffDays <= 28) {
        toKeep.add(b.public_id);
      }
      // 3. Keep 1st of month for last 365 days (12 months)
      else if (isFirstOfMonth && diffDays <= 365) {
        toKeep.add(b.public_id);
      }
    });

    const toDelete = backups
      .filter(b => !toKeep.has(b.public_id))
      .map(b => b.public_id);

    if (toDelete.length > 0) {
      console.info(`Pruning ${toDelete.length} expired backups...`);
      // Cloudinary allows deleting up to 100 resources at once
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        await cloudinary.api.delete_resources(batch, { resource_type: 'raw' });
      }
      console.info('✅ Pruning complete.');
    } else {
      console.info('No backups expired yet. Skipping deletion.');
    }
  } catch (error) {
    console.warn(`⚠️ Retention pruning error: ${error.message}`);
  }
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `kucet_db_backup_${timestamp}.sql`;
  const backupPath = path.join(os.tmpdir(), backupFilename);

  console.info(`--- STARTING DATABASE BACKUP [${new Date().toLocaleString()}] ---`);

  try {
    console.info(`Exporting database to temporary directory: ${backupPath}...`);

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

    const localSize = fs.statSync(backupPath).size;
    const localHash = await calculateFileHash(backupPath);
    console.info(`✅ Export complete. Size: ${(localSize / 1024 / 1024).toFixed(2)} MB`);
    console.info(`Local MD5: ${localHash}`);

    // 2. Upload to Cloudinary with restricted access mode
    console.info('Uploading to Cloudinary (backups folder)...');
    const result = await cloudinary.uploader.upload(backupPath, {
      folder: 'kucet/backups',
      resource_type: 'raw',
      public_id: backupFilename,
      access_mode: 'authenticated',
    });

    // 3. CHECKSUM VERIFICATION (Verify ETag matches local MD5)
    // Cloudinary ETag is the MD5 of the uploaded file for raw resources
    if (result.etag === localHash) {
      console.info('🚀 CHECKSUM VERIFIED: Backup safely stored and intact.');
      console.info(`Cloudinary URL: ${result.secure_url}`);
    } else {
      throw new Error(`Checksum mismatch! Local: ${localHash}, Cloudinary: ${result.etag}`);
    }

    // 4. Run Retention Policy
    await pruneBackups();

  } catch (error) {
    console.error(`❌ Backup Failed: ${error.message}`);
    // Send failure email to developers
    await sendFailureEmail(error.message);
    process.exit(1); // Signal failure to GitHub Actions
  } finally {
    // 5. Cleanup local file
    if (fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
        console.info('Sweep: Local temporary file removed.');
      } catch (cleanupErr) {
        console.warn(`🧹 Warning: Failed to remove temp file: ${cleanupErr.message}`);
      }
    }
    console.info('--- BACKUP PROCESS COMPLETE ---');
  }
}

runBackup();
