import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { v2 as cloudinary } from 'cloudinary';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const { filename } = await req.json();
    if (!filename) return apiError('Filename is required.', 400);

    // Validate filename: allow only alphanumerics, dots, dashes, underscores, .sql extension
    if (!/^[A-Za-z0-9._-]+\.sql$/.test(filename)) {
      return apiError('Invalid filename.', 400);
    }

    // SECURITY: We could verify password again here if we had it hashed, 
    // but the getAuthUser already verified the session.
    // For now, we trust the Super Admin session but log it heavily.
    logger.warn(`[CRITICAL_ACTION] Super Admin ${user.email} initiated DATABASE RESTORE using ${filename}`);

    const publicId = `kucet/backups/${filename}`;
    const tempFilePath = path.join(os.tmpdir(), `restore_${new Date().getTime()}.sql`);

    // 1. Download the backup file
    const downloadUrl = cloudinary.utils.private_download_url(publicId, 'sql', {
      resource_type: 'raw'
    });

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Failed to download backup file from cloud.');
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // 2. Perform Restore using mysql CLI
    // Note: This requires mysql client to be installed on the system/container.
    return new Promise((resolve) => {
      const mysqlArgs = [
        `--host=${process.env.DB_HOST}`,
        `--user=${process.env.DB_USER}`,
        `--port=${process.env.DB_PORT || 3306}`,
        process.env.DB_DATABASE
      ];

      // Pass password via environment variable instead of command line
      const mysqlEnv = { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD };

      // Handle SSL for TiDB Cloud if needed
      if (process.env.DB_SSL === 'true' || process.env.DB_HOST.includes('tidbcloud.com')) {
        mysqlArgs.push('--ssl-mode=REQUIRED');
      }

      // We use spawn and pipe the file into stdin
      const mysqlProcess = spawn('mysql', mysqlArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: mysqlEnv
      });

      mysqlProcess.on('error', (err) => {
        logger.error(`Failed to start mysql restore process: ${err.message}`);
        // Clean up on error
        if (fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        resolve(apiError('Failed to initiate mysql restoration.', 500));
      });

      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.pipe(mysqlProcess.stdin);

      let errorOutput = '';
      mysqlProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      mysqlProcess.on('close', (code) => {
        // Cleanup
        if (fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        fileStream.destroy();

        if (code === 0) {
          logger.info(`[RESTORE_SUCCESS] Database successfully restored from ${filename}`);
          resolve(apiResponse({ success: true, message: 'Database restoration successful.' }));
        } else {
          logger.error(`[RESTORE_FAILED] Database restore failed with code ${code}. Error: ${errorOutput}`);
          resolve(apiError('Database restoration failed.', 500));
        }
      });
    });

  } catch (error) {
    logger.error(error, 'Error during database restore');
    return apiError('Internal Server Error', 500);
  }
}
