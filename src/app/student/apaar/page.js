import { Suspense } from 'react';
import StudentApaarClient from './StudentApaarClient';
import { StudentDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'APAAR ID Guidance & Registration | KUCET Student Portal',
  description: 'Official guidance and registration portal for the Automated Permanent Academic Account Registry (APAAR ID) under the Academic Bank of Credits (ABC) initiative.',
};

export default function StudentApaarPage() {
  return (
    <Suspense fallback={<StudentDashboardSkeleton />}>
      <StudentApaarClient />
    </Suspense>
  );
}
