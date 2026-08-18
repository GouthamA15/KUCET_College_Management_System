'use client';

import { useStaff } from '@/context/StaffContext';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import HODConsole from '@/components/staff/faculty/HODConsole';

export default function HodDashboardClient() {
  const { clerkData, loading } = useStaff();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!clerkData || !clerkData.is_hod)) {
      router.replace('/staff/faculty/dashboard');
    }
  }, [clerkData, loading, router]);

  if (loading || !clerkData || !clerkData.is_hod) {
    return null;
  }

  const firstName = clerkData?.name?.split(' ')[0] || 'HOD';

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
      <div className="mt-3 space-y-3">
        <h1 className="text-center text-3xl font-black tracking-tight text-slate-800 uppercase">Welcome, {firstName}</h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
          <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
            {clerkData?.branch} Department
          </span>
          <span className="text-slate-200">|</span>
          <span className="text-xs font-medium uppercase tracking-tight">HEAD OF DEPARTMENT</span>
        </div>
      </div>

      <Suspense fallback={<div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent animate-spin rounded-full"></div></div>}>
        <HODConsole />
      </Suspense>
    </div>
  );
}
