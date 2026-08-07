import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import PushNotificationService from '@/services/security/PushNotificationService';

export async function GET(_req) {
  try {
    const user = await getAuthUser('student') || await getAuthUser('clerk') || await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const userId = user.roll_no || user.email || user.id;
    const userType = user.role || 'student';

    const preferences = await PushNotificationService.getPreferences(userId, userType);
    return apiResponse({ preferences });
  } catch (error) {
    return apiError(error.message || 'Failed to fetch notification preferences', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('student') || await getAuthUser('clerk') || await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json();
    const userId = user.roll_no || user.email || user.id;
    const userType = user.role || 'student';

    const result = await PushNotificationService.updatePreferences(userId, userType, body.categories);
    return apiResponse(result);
  } catch (error) {
    return apiError(error.message || 'Failed to update preferences', 500);
  }
}
