import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export default async function ClerkLayout({ children }) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    redirect('/');
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    redirect('/');
  }

  const { role } = decoded;
  const headersList = await headers();
  const pathname = headersList.get('x-next-pathname');

  if (pathname === '/clerk') {
    redirect(`/clerk/${role}/dashboard`);
  }

  if (pathname && pathname.startsWith('/clerk/')) {
    const requestedDashboard = pathname.split('/')[2];
    if (requestedDashboard !== role) {
      redirect(`/clerk/${role}/dashboard`);
    }
  }

  return <>{children}</>;
}