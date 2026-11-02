import React, { Suspense } from 'react';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First-Year Student ID Cards | KUCET Coordinator',
  description: 'Manage, preview, and generate KUCET first-year student identity cards.',
};

export default function FirstYearIDCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading First-Year ID Card Management..." />}>
        <IDCardManagementHub 
          initialBranch="ALL" 
          qrMode="standard"
          hubTitle="First-Year Student ID Cards (Standard QR)"
          hubDescription="Generates official identity cards with standard institutional verification QR codes for eligible first-year students."
          badgeText="First-Year Standard QR"
          bulkHref="/staff/first-year/id-cards/bulk"
        />
      </Suspense>
    </div>
  );
}
