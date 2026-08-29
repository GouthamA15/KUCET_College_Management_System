import logger from '@/lib/logger';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService.js';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

export async function GET(_req, context) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const { filename } = await context.params;
    if (!filename) return apiError('Filename is required.', 400);

    const backupInfo = DatabaseBackupService.getBackupStream(filename);
    const nodeStream = backupInfo.stream;
    const webStream = Readable.toWeb(nodeStream);

    const headers = new Headers({
      'Content-Type': backupInfo.isGzip ? 'application/gzip' : 'application/sql',
      'Content-Disposition': `attachment; filename="${backupInfo.filename}"`,
      'Content-Length': String(backupInfo.size),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });

    return new NextResponse(webStream, { headers });
  } catch (error) {
    logger.error({ err: error.message }, 'Error serving backup download');
    const status = error.message.includes('not found') ? 404 : (error.message.includes('Access denied') ? 403 : 500);
    return apiError(error.message || 'Error downloading backup file.', status);
  }
}
