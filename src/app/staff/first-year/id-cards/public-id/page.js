import React, { Suspense } from 'react';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First-Year Public Student Identification QR ID Cards | KUCET Coordinator',
  description: 'Generates first-year student ID cards with QR codes that open the official KUCET public student identification page.',
};

export default function FirstYearPublicIDCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Public Student Identification QR ID Card Generator..." />}>
        <IDCardManagementHub 
          initialBranch="ALL" 
          qrMode="public_url"
          hubTitle="First-Year Public Student Identification QR ID Card Generator"
          hubDescription="Generates student ID cards with QR codes that open the official KUCET public student identification page."
          badgeText="First-Year Public URL QR"
          bulkHref="/staff/first-year/id-cards/bulk?mode=public_url"
        />
      </Suspense>
    </div>
  );
}
