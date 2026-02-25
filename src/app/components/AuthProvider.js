'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { getDashboardPathByRole } from '@/lib/auth-utils';

function SessionMonitor({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('AuthProvider SessionMonitor useEffect:', { status, session });

    // Allow certain public routes (like password reset) even for authenticated users
    const isPasswordResetRoute = pathname?.startsWith('/reset-password');

    if (status === "authenticated" && session?.user?.role && !isPasswordResetRoute) {
      const redirectPath = getDashboardPathByRole(session.user.role);
      console.log('AuthProvider SessionMonitor: Initiating redirect to', redirectPath);
      router.push(redirectPath);
    } else if (status === "unauthenticated") {
      console.log('AuthProvider SessionMonitor: User is unauthenticated.');
    } else if (status === "loading") {
      console.log('AuthProvider SessionMonitor: Session is loading.');
    }
  }, [status, session, router]);

  return children;
}

export default function AuthProvider({ children }) {
  return (
    <SessionProvider>
      <SessionMonitor>{children}</SessionMonitor>
    </SessionProvider>
  );
}
