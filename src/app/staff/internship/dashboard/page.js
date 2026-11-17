import { Suspense } from 'react';
import CoordinatorInternshipDashboardClient from './CoordinatorInternshipDashboardClient';

export const metadata = {
  title: 'Internship Coordination Console | KUCET CMS',
  description: 'College-wide designated Internship Coordinator console: review applications, verify external registrations, validate completion certificates, manage companies and opportunities.',
};

export default function CoordinatorInternshipPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-pulse p-4">
        <div className="h-28 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    }>
      <CoordinatorInternshipDashboardClient />
    </Suspense>
  );
}
