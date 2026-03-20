'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { getDashboardPathByRole } from '@/lib/path-utils';

function SessionMonitor({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Allow certain public routes (like password reset) even for authenticated users
    const isPasswordResetRoute = pathname?.startsWith('/reset-password');
    const isHome = pathname === '/';

    // Only redirect to dashboard if user is authenticated AND they are on the login/home page
    // This prevents redirecting when the user is already on a deeper protected page (e.g. attendance)
    if (status === "authenticated" && session?.user?.role && isHome && !isPasswordResetRoute) {
      const redirectPath = getDashboardPathByRole(session.user.role);
      router.push(redirectPath);
    }
  }, [status, session, router, pathname]);

  return children;
}

export default function AuthProvider({ children }) {
  return (
    <SessionProvider session={null} refetchInterval={0} refetchOnWindowFocus={false}>
      <SessionMonitor>{children}</SessionMonitor>
    </SessionProvider>
  );
}
