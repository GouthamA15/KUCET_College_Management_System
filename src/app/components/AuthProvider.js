'use client';

import { useEffect, useState, useCallback } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { getDashboardPathByRole } from '@/lib/path-utils';

/**
 * Detect companion cookies (these are NOT httpOnly, so JS can read them).
 * Returns the detected user type or null.
 */
function getSessionType() {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie;
  if (cookies.includes('admin_logged_in=')) return 'admin';
  if (cookies.includes('clerk_logged_in=')) return 'clerk';
  if (cookies.includes('student_logged_in=')) return 'student';
  return null;
}

/**
 * AuthRestoreGuard — Client-side auth restoration for custom JWT roles (student/admin/clerk).
 *
 * Problem: The middleware's internal fetch to /api/auth/refresh can time out on Render's
 * cold starts, leaving the user on the login page even though their cookies are valid.
 * This component closes that gap by performing the refresh directly from the browser
 * while showing a loading screen, then redirecting once the session is confirmed.
 */
function AuthRestoreGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  // null = still checking, false = no session, true = session confirmed
  const [authStatus, setAuthStatus] = useState(null);

  const restoreAuth = useCallback(async () => {
    const sessionType = getSessionType();

    // Not on the root page, or no companion cookie — skip restoration entirely
    if (pathname !== '/' || !sessionType) {
      setAuthStatus(false);
      return;
    }

    // Companion cookie exists — try to restore session via a direct client-side fetch.
    // This bypasses the middleware's loopback fetch which can deadlock on Render.
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sessionType }),
        credentials: 'include', // ensure cookies are sent
      });

      if (res.ok) {
        // Refresh succeeded — new cookies are now in the browser.
        // Determine destination from the session type.
        let destination = '/student';
        if (sessionType === 'admin') {
          destination = '/admin/dashboard';
        } else if (sessionType === 'clerk') {
          // Read the clerk_role cookie to pick the right dashboard
          const clerkRoleMatch = document.cookie.match(/clerk_role=([^;]+)/);
          const clerkRole = clerkRoleMatch?.[1];
          destination = getDashboardPathByRole(clerkRole) || '/clerk';
        }
        
        // CRITICAL: We MUST use window.location.href instead of router.replace() here.
        // If the user manually navigated to /student and was bounced back to / by the middleware,
        // the Next.js client router caches that redirect. Calling router.replace('/student') 
        // will instantly hit the cache and bounce them back to the login page without even
        // asking the server. A hard navigation forces the middleware to run again with the new cookies.
        window.location.href = destination;
        return;
      }

      // 4xx = genuinely invalid credentials, fall through to login page
      if (res.status >= 400 && res.status < 500) {
        setAuthStatus(false);
        return;
      }

      // 5xx = server error, don't destroy session — show login but keep cookies
      setAuthStatus(false);
    } catch {
      // Network error — don't destroy session
      setAuthStatus(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await restoreAuth();
    };
    if (!cancelled) run();
    return () => { cancelled = true; };
  }, [restoreAuth]);

  // While checking on the root page with a companion cookie, show a loading screen.
  if (authStatus === null && pathname === '/' && getSessionType()) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #0b3578',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p
          style={{
            marginTop: 18,
            fontSize: 15,
            color: '#475569',
            fontFamily: 'inherit',
            letterSpacing: '0.01em',
          }}
        >
          Restoring your session…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return children;
}

/**
 * NextAuth-based monitor for Google OAuth clerk sessions.
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
        <AuthRestoreGuard>
          {children}
        </AuthRestoreGuard>
      </NextAuthSessionMonitor>
    </SessionProvider>
  );
}
