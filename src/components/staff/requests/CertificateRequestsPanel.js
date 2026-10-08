'use client';
import React from 'react';
import CertificateDashboard from '@/components/staff/certificates/CertificateDashboard';

const CertificateRequestsPanel = ({ staffType = 'admission' }) => {
    return <CertificateDashboard staffType={staffType} />;
};

export default CertificateRequestsPanel;
