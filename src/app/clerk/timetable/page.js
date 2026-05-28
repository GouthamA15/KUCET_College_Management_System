"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';

export default function ClerkTimetableRedirect() {
  const router = useRouter();
  const { clerkData, loading } = useClerk();

  useEffect(() => {
    if (!loading && clerkData) {
      if (clerkData.role === 'faculty') {
        router.replace('/clerk/faculty/time-table');
      }
    }
  }, [clerkData, loading, router]);

  if (loading) return null;

  if (clerkData?.role !== 'faculty') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-5xl mb-4">📅</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Time Table Not Applicable</h1>
        <p className="text-slate-600 max-w-md">
          The personal timetable view is only available for Faculty members and Heads of Department.
          As a {clerkData?.role} clerk, your primary modules are accessible from the sidebar.
        </p>
      </div>
    );
  }

  return null;
}
