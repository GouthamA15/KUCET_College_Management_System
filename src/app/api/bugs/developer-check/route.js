import { apiResponse } from '@/lib/api-utils';
import { isDeveloper } from '@/lib/developers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    let email = null;
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      email = session.user.email;
    }

    return apiResponse({
      isDeveloper: isDeveloper(email),
      email
    });
  } catch {
    return apiResponse({ isDeveloper: false, email: null });
  }
}
