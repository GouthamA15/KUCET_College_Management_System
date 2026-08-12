'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { getDashboardPathByRole } from '@/lib/path-utils';

/**
 * NextAuth-based monitor for Google OAuth clerk sessions.
 * Note: JWT student/clerk sessions are restored and handled natively in HomeLoginLanding.client.js
 */
function NextAuthSessionMonitor({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isPasswordResetRoute = pathname?.startsWith('/reset-password');
    const isHome = pathname === '/';

    if (status === 'authenticated' && session?.user?.role && isHome && !isPasswordResetRoute) {
      const redirectPath = getDashboardPathByRole(session.user.role);
      router.push(redirectPath);
    }
  }, [status, session, router, pathname]);

  return children;
}

export default function AuthProvider({ children }) {
  return (
    <SessionProvider session={null} refetchInterval={0} refetchOnWindowFocus={false}>
      <NextAuthSessionMonitor>
        {children}
      </NextAuthSessionMonitor>
    </SessionProvider>
  );
}
