import { Suspense } from 'react';
import ScholarshipDashboardClient from './ScholarshipDashboardClient';
import { ClerkDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Scholarship Dashboard | KUCET CMS',
  description: 'Scholarship clerk workspace for managing financial fee ledgers, government scholarship reimbursements, and verification queues.',
};

export default function ScholarshipDashboard() {
  return (
    <Suspense fallback={<ClerkDashboardSkeleton />}>
      <ScholarshipDashboardClient />
    </Suspense>
  );
}
