import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { DatabaseBackupService } from '../services/backup/DatabaseBackupService.js';
import { BACKUP_CONSTANTS } from '../services/backup/backup.constants.js';

// Load environment variables
const envLocal = path.resolve(process.cwd(), '.env.local');
const envProd = path.resolve(process.cwd(), '.env.production');
const envBase = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envProd)) {
  dotenv.config({ path: envProd });
} else if (fs.existsSync(envBase)) {
  dotenv.config({ path: envBase });
}

const DEVELOPER_EMAILS = [
  "sunnysunnit@gmail.com",
  "testersybau67@gmail.com",
  "uzair.mdf@gmail.com"
];

/**
 * Sends failure alert to developer emails via Brevo API if available
 */
async function sendFailureEmail(errorMessage) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey || !senderEmail) {
    console.warn('[BACKUP_EMAIL] Brevo configuration missing. Skipping email notification.');
    return;
  }

  try {
    const payload = {
      sender: { email: senderEmail, name: 'KUCET Backup System' },
      to: DEVELOPER_EMAILS.map(email => ({ email })),
      subject: '❌ URGENT: KUCET Database Backup Failed',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #b91c1c;">Database Backup Failure</h2>
          <p>The automated database backup for <strong>KUCET College Management System</strong> has encountered an error.</p>
          <div style="background: #fee2e2; border: 1px solid #f87171; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Error Message:</strong><br/>
            <code style="color: #b91c1c;">${errorMessage}</code>
          </div>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p>Please check server logs immediately to diagnose and resolve the issue.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated system alert from KUCET CMS.</p>
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
      console.info('✅ Failure alerts dispatched via Brevo.');
    }
  } catch (error) {
    console.error('❌ Exception dispatching failure alerts:', error.message);
  }
}

async function runCliBackup() {
  console.info(`--- STARTING DATABASE BACKUP [${new Date().toLocaleString()}] ---`);
  try {
    const result = await DatabaseBackupService.createBackup({
      triggeredBy: 'SYSTEM_CLI_OR_CRON',
      type: BACKUP_CONSTANTS.BACKUP_TYPES.SCHEDULED,
    });

    console.info('✅ BACKUP COMPLETED AND VERIFIED.');
    console.info(`Filename: ${result.filename}`);
    console.info(`Size: ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.info(`SHA-256: ${result.checksum}`);
    console.info(`Duration: ${result.durationMs} ms`);
    console.info(`Retention Pruned: ${result.pruneReport.prunedCount} old files removed`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Backup Execution Failed: ${error.message}`);
    await sendFailureEmail(error.message);
    process.exit(1);
  }
}

runCliBackup();
