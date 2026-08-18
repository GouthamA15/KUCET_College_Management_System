import { Suspense } from 'react';
import AuditLogsClient from './AuditLogsClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'System Audit Trails | KUCET CMS',
  description: 'Super Admin immutable security audit trails and data modification tracking.',
};

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AuditLogsClient />
    </Suspense>
  );
}
