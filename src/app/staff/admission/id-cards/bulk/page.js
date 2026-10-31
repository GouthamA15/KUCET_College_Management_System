import React, { Suspense } from 'react';
import BulkIdCardDownload from '@/components/staff/id-cards/BulkIdCardDownload';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'Bulk Student ID Card Download | KUCET Admissions',
  description: 'Generate individual student ID card PDFs and download them as a ZIP archive.',
};

export default function BulkIdCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Bulk Student ID Card Generator..." />}>
        <BulkIdCardDownload defaultBranch="ALL" isCoordinatorMode={false} />
      </Suspense>
    </div>
  );
}
