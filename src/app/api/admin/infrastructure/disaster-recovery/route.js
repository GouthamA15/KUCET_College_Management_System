import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import DisasterRecoveryService from '@/services/archive/DisasterRecoveryService';

export async function POST(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const report = await DisasterRecoveryService.executeFullSystemRecovery();
    return apiResponse(report);
  } catch (error) {
    return apiError(error.message || 'Disaster recovery procedure failed', 500);
  }
}

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const dbIntegrity = await DisasterRecoveryService.verifyDatabaseIntegrity();
    return apiResponse({ status: 'READY', dbIntegrity });
  } catch (error) {
    return apiError(error.message || 'Disaster recovery status check failed', 500);
  }
}
