import { Suspense } from 'react';
import InfrastructureClient from './InfrastructureClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'System Infrastructure & Storage | KUCET CMS',
  description: 'Super Admin system infrastructure, database backups, and storage explorer.',
};

export default function InfrastructurePage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <InfrastructureClient />
    </Suspense>
  );
}
