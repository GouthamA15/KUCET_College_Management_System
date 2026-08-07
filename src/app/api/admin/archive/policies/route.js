import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveService } from '@/services/archive/ArchiveService';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const policies = await ArchiveService.getRetentionPolicies();
    return apiResponse({ policies });
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_POLICIES_GET_ERROR]');
    return apiError(error.message || 'Failed to fetch retention policies', 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const body = await req.json().catch(() => ({}));
    const { entity_type, auto_archive_enabled, retention_months, description } = body;

    if (!entity_type) {
      return apiError('Missing required parameter: entity_type', 400);
    }

    const updated_by = user.email || user.name || 'ADMIN';
    const result = await ArchiveService.updateRetentionPolicy(entity_type, {
      auto_archive_enabled,
      retention_months: Number(retention_months),
      description,
    }, updated_by);

    return apiResponse(result);
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_POLICIES_PATCH_ERROR]');
    return apiError(error.message || 'Failed to update retention policy', 500);
  }
}
