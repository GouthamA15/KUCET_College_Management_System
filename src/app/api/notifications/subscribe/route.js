import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import PushNotificationService from '@/services/security/PushNotificationService';

export async function POST(req) {
  try {
    const user = await getAuthUser('student') || await getAuthUser('clerk') || await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json();
    const userId = user.roll_no || user.email || user.id;
    const userType = user.role || 'student';

    const result = await PushNotificationService.subscribe(userId, userType, body.subscription);
    return apiResponse(result);
  } catch (error) {
    return apiError(error.message || 'Subscription failed', 500);
  }
}

export async function DELETE(_req) {
  try {
    const user = await getAuthUser('student') || await getAuthUser('clerk') || await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const userId = user.roll_no || user.email || user.id;
    const userType = user.role || 'student';

    const result = await PushNotificationService.unsubscribe(userId, userType);
    return apiResponse(result);
  } catch (error) {
    return apiError(error.message || 'Unsubscribe failed', 500);
  }
}
