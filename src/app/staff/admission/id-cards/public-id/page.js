import React, { Suspense } from 'react';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'Public Student Identification QR ID Cards | KUCET Admissions',
  description: 'Generates student ID cards with QR codes that open the official KUCET public student identification page.',
};

export default function PublicIdCardGeneratorPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Public Student Identification QR ID Card Generator..." />}>
        <IDCardManagementHub 
          initialBranch="ALL" 
          qrMode="public_url"
          hubTitle="Public Student Identification QR ID Card Generator"
          hubDescription="Generates student ID cards with QR codes that open the official KUCET public student identification page."
          badgeText="Public Identification URL QR"
          bulkHref="/staff/admission/id-cards/bulk?mode=public_url"
        />
      </Suspense>
    </div>
  );
}
