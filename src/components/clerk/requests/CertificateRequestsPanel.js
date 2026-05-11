'use client';
import React from 'react';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';

const CertificateRequestsPanel = () => {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-1">
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Certificate & ID Queue</h2>
                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-1 tracking-wider">Approve or reject document requests submitted by students</p>
                </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden p-6 md:p-8">
                <CertificateDashboard clerkType="admission" />
            </div>
        </div>
    );
};

export default CertificateRequestsPanel;
