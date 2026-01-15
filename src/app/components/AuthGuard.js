'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Function to check if JWT exists and is valid
    const checkAuth = () => {
      const isClerkRoute = pathname.startsWith('/clerk');
      const isAdminRoute = pathname.startsWith('/admin');
      const isStudentRoute = pathname.startsWith('/student');
      const isHomeRoute = pathname === '/';

      if (isClerkRoute) {
        // Check if clerk is logged in
        const clerkLoggedIn = Cookies.get('clerk_logged_in') === 'true';
        if (!clerkLoggedIn) {
          router.replace('/');
        }
      } else if (isAdminRoute) {
        // Check if admin is logged in
        const adminLoggedIn = Cookies.get('admin_logged_in') === 'true';
        if (!adminLoggedIn) {
          router.replace('/');
        }
      } else if (isStudentRoute) {
        // Check if student is logged in
        const studentLoggedIn = localStorage.getItem('logged_in_student');
        if (!studentLoggedIn) {
          router.replace('/');
        }
      }
      // For home and other routes, allow access
    };

    checkAuth();
  }, [pathname, router]);

  return <>{children}</>;
}