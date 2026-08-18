import { Suspense } from 'react';
import StudentFinancesClient from './StudentFinancesClient';

export const metadata = {
  title: 'Fee Details & Scholarships | KUCET CMS',
  description: 'Institutional fee structures, government scholarship sanctions, and payment transactions for KUCET students.',
};

export default function StudentFinancesPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="h-8 skeleton-shimmer w-64 rounded mb-2"></div>
          <div className="h-4 skeleton-shimmer w-96 rounded"></div>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-md p-3 sm:p-4 border border-gray-200 h-28 skeleton-shimmer"></div>
          ))}
        </div>
        <div className="h-64 skeleton-shimmer rounded border border-gray-200"></div>
      </div>
    }>
      <StudentFinancesClient />
    </Suspense>
  );
}
