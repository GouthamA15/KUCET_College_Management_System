import { Suspense } from 'react';
import ScholarshipDashboardClient from './ScholarshipDashboardClient';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Scholarship Dashboard | KUCET CMS',
  description: 'Scholarship staff workspace for managing financial fee ledgers, government scholarship reimbursements, and verification queues.',
};

export default function ScholarshipDashboard() {
  return (
    <Suspense fallback={<StaffDashboardSkeleton />}>
      <ScholarshipDashboardClient />
    </Suspense>
  );
}
