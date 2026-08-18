import { Suspense } from 'react';
import StaffRequestsClient from './StaffRequestsClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Staff Registration Requests | KUCET CMS',
  description: 'Super Admin workflow for reviewing, approving, and activating self-registered staff and faculty accounts.',
};

export default function StaffRequestsPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <StaffRequestsClient />
    </Suspense>
  );
}
