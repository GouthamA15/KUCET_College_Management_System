import { Suspense } from 'react';
import StudentAcademicsClient from './StudentAcademicsClient';

export const metadata = {
  title: 'Academics & Performance | KUCET CMS',
  description: 'Academic subjects, attendance, syllabus, and internal examination marks for KUCET students.',
};

export default function AcademicsPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="h-8 skeleton-shimmer w-64 rounded mb-2"></div>
          <div className="h-4 skeleton-shimmer w-96 rounded"></div>
        </header>
        <div className="flex gap-2 mb-3">
          <div className="h-9 w-24 skeleton-shimmer rounded"></div>
          <div className="h-9 w-24 skeleton-shimmer rounded"></div>
          <div className="h-9 w-24 skeleton-shimmer rounded"></div>
        </div>
        <div className="h-64 skeleton-shimmer rounded border border-gray-200"></div>
      </div>
    }>
      <StudentAcademicsClient />
    </Suspense>
  );
}
