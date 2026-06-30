'use client';
import React from 'react';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';

const CertificateRequestsPanel = () => {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-1">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Certificate & ID Queue</h2>
                  <p className="text-sm text-gray-500 mt-1">Approve or reject document requests submitted by students</p>
                </div>
            </div>

            <div className="bg-white">
                <CertificateDashboard clerkType="admission" />
            </div>
        </div>
    );
};

export default CertificateRequestsPanel;
