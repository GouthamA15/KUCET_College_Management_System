'use client';
// This route has been renamed/moved to /staff/faculty/academics.
// This file exists only to redirect stale bookmarks and links.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/staff/faculty/academics');
  }, [router]);
  return null;
}
