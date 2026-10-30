import { Suspense } from 'react';
import InstitutionalRolesClient from './InstitutionalRolesClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Institutional Roles & Academic Supervisor | KUCET CMS',
  description: 'Super Admin console for managing institutional Principal roles and designated Academic Supervisor authority.',
};

export default function InstitutionalRolesPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <InstitutionalRolesClient />
    </Suspense>
  );
}
