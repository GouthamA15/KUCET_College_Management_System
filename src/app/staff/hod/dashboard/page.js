import { Suspense } from 'react';
import HodDashboardClient from './HodDashboardClient';

export const metadata = {
  title: 'HOD Console & Department Management | KUCET CMS',
  description: 'Head of Department management console for timetables, faculty workloads, and departmental analytics.',
};

export default function HODDashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 font-sans">
        <div className="mt-3 space-y-3 flex flex-col items-center">
          <div className="h-8 skeleton-shimmer w-64 rounded"></div>
          <div className="h-4 skeleton-shimmer w-48 rounded"></div>
        </div>
        <div className="h-96 skeleton-shimmer rounded border border-slate-200"></div>
      </div>
    }>
      <HodDashboardClient />
    </Suspense>
  );
}
