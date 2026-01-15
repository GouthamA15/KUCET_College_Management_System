'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Function to check authentication
    const checkAuth = () => {
      const isClerkRoute = pathname.startsWith('/clerk');
      const isAdminRoute = pathname.startsWith('/admin');
      const isStudentRoute = pathname.startsWith('/student');

      if (isClerkRoute) {
        // Check if clerk JWT token exists
        const clerkToken = Cookies.get('clerk_auth');
        const clerkLoggedIn = Cookies.get('clerk_logged_in') === 'true';

        if (!clerkToken || !clerkLoggedIn) {
          // Clear any partial auth state
          Cookies.remove('clerk_auth');
          Cookies.remove('clerk_logged_in');
          sessionStorage.removeItem('clerk_authenticated');
          router.replace('/');
          return;
        }

        // Set session storage to track auth state
        sessionStorage.setItem('clerk_authenticated', 'true');
      } else if (isAdminRoute) {
        // Check if admin JWT token exists
        const adminToken = Cookies.get('admin_auth');
        const adminLoggedIn = Cookies.get('admin_logged_in') === 'true';

        if (!adminToken || !adminLoggedIn) {
          Cookies.remove('admin_auth');
          Cookies.remove('admin_logged_in');
          sessionStorage.removeItem('admin_authenticated');
          router.replace('/');
          return;
        }

        sessionStorage.setItem('admin_authenticated', 'true');
      } else if (isStudentRoute) {
        // Check if student is logged in
        const studentLoggedIn = localStorage.getItem('logged_in_student');
        if (!studentLoggedIn) {
          router.replace('/');
        }
      }
    };

    checkAuth();
  }, [pathname, router]);

  return <>{children}</>;
}