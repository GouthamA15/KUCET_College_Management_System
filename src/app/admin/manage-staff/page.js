import { Suspense } from 'react';
import ManageStaffClient from './ManageStaffClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Manage Staff & Roles | KUCET CMS',
  description: 'Super Admin console for managing staff accounts, department assignments, and HOD promotions.',
};

export default function ManageStaffPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <ManageStaffClient />
    </Suspense>
  );
}
