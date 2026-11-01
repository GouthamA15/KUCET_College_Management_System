import { Suspense } from 'react';
import CoordinatorWorkspaceClient from './CoordinatorWorkspaceClient';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First Year Coordinator Workspace | KUCET CMS',
  description: 'First Year Coordinator institutional workspace for managing curriculum, timetables, faculty subject interests, and student ID cards across all branches.',
};

export default function FirstYearCoordinatorDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Coordinator Workspace..." />}>
        <CoordinatorWorkspaceClient />
      </Suspense>
    </div>
  );
}
