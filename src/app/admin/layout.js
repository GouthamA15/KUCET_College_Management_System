'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    // Check for admin_logged_in cookie (not httpOnly)
    const cookies = document.cookie.split(';');
    const adminLoggedIn = cookies.find(cookie => cookie.trim().startsWith('admin_logged_in='));

    if (!adminLoggedIn || adminLoggedIn.split('=')[1] !== 'true') {
      // No valid session, redirect to home
      router.replace('/');
      return;
    }

    // Prevent browser back button from showing cached pages
    const handleBeforeUnload = () => {
      // Clear any cached state
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router]);

  return <>{children}</>;
}