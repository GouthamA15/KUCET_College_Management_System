import { Suspense } from 'react';
import ClassTimetable from '@/components/student/ClassTimetable';

export const metadata = {
  title: 'Weekly Timetable | KUCET CMS',
  description: 'Departmental weekly lecture, lab, and seminar timetable for KUCET students.',
};

export default function TimetablePage() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <Suspense fallback={
        <div className="w-full h-96 skeleton-shimmer rounded-md border border-slate-200"></div>
      }>
        <ClassTimetable />
      </Suspense>
    </div>
  );
}
