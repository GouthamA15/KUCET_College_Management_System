import { Suspense } from 'react';
import FacultyDashboardClient from './FacultyDashboardClient';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Faculty Dashboard | KUCET CMS',
  description: 'Faculty workspace for managing subject attendance, internal assessments, teaching interests, and class schedules.',
};

export default function FacultyDashboardOverview() {
  return (
    <Suspense fallback={<StaffDashboardSkeleton />}>
      <FacultyDashboardClient />
    </Suspense>
  );
}
