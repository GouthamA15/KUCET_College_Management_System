'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import ComingSoon from '@/components/ComingSoon';

export default function ClerkTimetableRedirect() {
  const router = useRouter();
  const { clerkData, loading } = useClerk();

  useEffect(() => {
    if (!loading && clerkData) {
      if (clerkData.role === 'faculty') {
        router.replace('/clerk/faculty/time-table');
      }
      // Admission and Scholarship currently use the base placeholder
      // but we can add more logic here if they get specific matrix views.
    }
  }, [clerkData, loading, router]);

  if (loading) return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <ComingSoon title="Time Table" icon="📅" />
    </div>
  );
}
