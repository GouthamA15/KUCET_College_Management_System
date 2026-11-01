import { Suspense } from 'react';
import CoordinatorApaarDashboard from '@/components/staff/first-year/CoordinatorApaarDashboard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First Year APAAR ID Monitoring | KUCET CMS',
  description: 'First Year Coordinator institutional workspace for tracking APAAR ID submission status, branch-wise filtering, and pending student reports.',
};

export default function FirstYearCoordinatorApaarPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading APAAR Monitoring Dashboard..." />}>
        <CoordinatorApaarDashboard />
      </Suspense>
    </div>
  );
}
