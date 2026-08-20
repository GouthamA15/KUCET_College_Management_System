import { Suspense } from 'react';
import StudentDashboardClient from './StudentDashboardClient';
import { StudentDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const metadata = {
  title: 'Student Dashboard | KUCET CMS',
  description: 'Student portal dashboard for Kakatiya University College of Engineering and Technology.',
};

export default function StudentHomePage() {
  return (
    <Suspense fallback={<StudentDashboardSkeleton />}>
      <StudentDashboardClient />
    </Suspense>
  );
}