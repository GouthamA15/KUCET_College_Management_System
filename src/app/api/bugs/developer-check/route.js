import { apiResponse, getAuthUser } from '@/lib/api-utils';
import { isDeveloper } from '@/lib/developers';

export async function GET() {
  try {
    let email = null;
    const user = await getAuthUser();
    if (user && user.email) {
      email = user.email;
    }

    return apiResponse({
      isDeveloper: isDeveloper(email),
      email
    });
  } catch {
    return apiResponse({ isDeveloper: false, email: null });
  }
}
