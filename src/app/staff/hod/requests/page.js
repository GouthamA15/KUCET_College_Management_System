'use client';

import React from 'react';
import CertificateDashboard from '@/components/staff/certificates/CertificateDashboard';

export default function HodCertificateRequestsPage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#0b2447]">Departmental Student Document Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and endorse Bonafide Certificate requests (Stage 1) and authorize No Objection Certificates (NOC) for students in your department.
        </p>
      </header>
      <CertificateDashboard staffType="hod" />
    </div>
  );
}
