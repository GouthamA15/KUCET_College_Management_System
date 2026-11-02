import React, { Suspense } from 'react';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const metadata = {
  title: 'First-Year Roll Number QR ID Cards | KUCET Coordinator',
  description: "Generates first-year student ID cards with QR codes containing only the student's hall-ticket number.",
};

export default function FirstYearRollNumberIDCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<LoadingSpinner label="Loading Roll Number QR ID Card Generator..." />}>
        <IDCardManagementHub 
          initialBranch="ALL" 
          qrMode="roll_number"
          hubTitle="First-Year Roll Number QR ID Card Generator"
          hubDescription="Generates student ID cards with QR codes containing only the student's hall-ticket number. Suitable for ordinary QR scanners and KUCET attendance scanning."
          badgeText="First-Year Roll Number QR"
          bulkHref="/staff/first-year/id-cards/bulk?mode=roll_number"
        />
      </Suspense>
    </div>
  );
}
