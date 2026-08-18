import { Suspense } from 'react';
import PaymentsClient from './PaymentsClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Payment & Fee Management | KUCET CMS',
  description: 'Super Admin ledger for institutional fee collections, scholarship disbursements, and certificate revenues.',
};

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <PaymentsClient />
    </Suspense>
  );
}
