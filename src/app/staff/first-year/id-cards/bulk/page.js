import React, { Suspense } from 'react';
import BulkIdCardDownload from '@/components/staff/id-cards/BulkIdCardDownload';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First-Year Bulk ID Card Download | KUCET Coordinator',
  description: 'Generate individual First-Year student ID card PDFs across all seven branches and download them as a ZIP archive.',
};

export default function FirstYearBulkIdCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading First-Year ID Card Generator..." />}>
        <BulkIdCardDownload defaultBranch="ALL" isCoordinatorMode={true} />
      </Suspense>
    </div>
  );
}
