import { Suspense } from 'react';
import SupervisorAcademicMonitoringClient from './SupervisorAcademicMonitoringClient';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'Institutional Academic Monitoring | KUCET CMS',
  description: 'Global Academic Performance and Attendance Monitoring for Institutional Leadership and Designated Academic Supervisors.',
};

export default function SupervisorAcademicMonitoringPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Institutional Academic Monitoring..." />}>
        <SupervisorAcademicMonitoringClient />
      </Suspense>
    </div>
  );
}
