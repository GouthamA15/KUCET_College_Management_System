import React, { Suspense } from 'react';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'Student ID Cards | KUCET Admissions',
  description: 'Manage, preview, and generate KUCET student identity cards.',
};

export default function AdmissionIDCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Student ID Card Management..." />}>
        <IDCardManagementHub initialBranch="ALL" />
      </Suspense>
    </div>
  );
}
