import { Suspense } from 'react';
import StudentInternshipClient from './StudentInternshipClient';

export const metadata = {
  title: 'Internships & Opportunities | KUCET CMS',
  description: 'Discover official internship opportunities, register external offers, upload offer letters, and submit completion certificates for coordinator verification.',
};

export default function StudentInternshipsPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-pulse p-4">
        <div className="h-28 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-slate-200 rounded-xl"></div>
          <div className="h-20 bg-slate-200 rounded-xl"></div>
          <div className="h-20 bg-slate-200 rounded-xl"></div>
          <div className="h-20 bg-slate-200 rounded-xl"></div>
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    }>
      <StudentInternshipClient />
    </Suspense>
  );
}
