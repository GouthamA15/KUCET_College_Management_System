import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { v2 as cloudinary } from 'cloudinary';
import { spawn } from 'child_process';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    // List all backup files in the folder
    const result = await cloudinary.api.resources_by_asset_folder('kucet/backups', {
      resource_type: 'raw',
      max_results: 100,
    });

    const backups = result.resources.map(b => ({
      name: b.public_id.split('/').pop(),
      size: b.bytes,
      created_at: b.created_at,
      secure_url: b.secure_url,
      etag: b.etag
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return apiResponse({ backups });
  } catch (error) {
    logger.error(error, 'Error listing backups');
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    logger.info(`[ADMIN] ${user.email} triggered manual database backup.`);

    // Trigger the backup script using tsx
    // We'll run it as a detached process or wait for it? 
    // Since it's an admin action, we'll wait and give feedback.
    
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'src', 'db', 'backup.js');
      const child = spawn('npx', ['tsx', scriptPath], { shell: true });

      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { output += data.toString(); });

      child.on('error', (err) => {
        logger.error(`Failed to start backup process: ${err.message}`);
        resolve(apiError('Failed to initiate backup process.', 500, err.message));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(apiResponse({ success: true, message: 'Backup completed successfully.' }));
        } else {
          logger.error(`Backup process failed with code ${code}. Output: ${output}`);
          resolve(apiError('Backup execution failed.', 500, output));
        }
      });
    });

  } catch (error) {
    logger.error(error, 'Error triggering backup');
    return apiError('Internal Server Error', 500);
  }
}
