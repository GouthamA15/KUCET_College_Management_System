import { Suspense } from 'react';
import AdminDashboardClient from './AdminDashboardClient';
import { AdminDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Super Admin Dashboard | KUCET CMS',
  description: 'Institutional administration console for college analytics, faculty management, and student registry.',
};

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardClient />
    </Suspense>
  );
}