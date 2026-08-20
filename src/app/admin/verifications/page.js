import { Suspense } from 'react';
import VerificationsClient from './VerificationsClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Verification Registry & Scan Security | KUCET CMS',
  description: 'Super Admin live monitor for certificate verification scans and forgery prevention.',
};

export default function VerificationsDashboard() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <VerificationsClient />
    </Suspense>
  );
}
