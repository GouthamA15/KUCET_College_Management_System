import { Suspense } from 'react';
import AdmissionDashboardClient from './AdmissionDashboardClient';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Admission Dashboard | KUCET CMS',
  description: 'Admission staff workspace for managing student admissions, roll number allocation, and registration requests.',
};

export default function AdmissionDashboardPage() {
  return (
    <Suspense fallback={<StaffDashboardSkeleton />}>
      <AdmissionDashboardClient />
    </Suspense>
  );
}
