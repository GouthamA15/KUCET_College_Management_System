'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import RequestTabs from '@/components/staff/requests/RequestTabs';
import AdmissionRequestsPanel from '@/components/staff/requests/AdmissionRequestsPanel';
import CertificateRequestsPanel from '@/components/staff/requests/CertificateRequestsPanel';
import StudentUpdateRequestsPanel from '@/components/staff/requests/StudentUpdateRequestsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function RequestsCenterContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { 
        pendingProfileRequests, 
        pendingCertificateRequests,
        isLoadingRequests,
        refreshProfileRequests,
        refreshCertificateRequests,
        refreshAdmissionDrafts,
        staffData
    } = useStaff();

    const activeTab = searchParams.get('tab') || 'admissions';

    useEffect(() => {
        if (staffData?.role) {
            refreshProfileRequests();
            refreshCertificateRequests(staffData.role);
            if (staffData.role === 'admission') {
                refreshAdmissionDrafts();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffData?.role]);

    const handleTabChange = (tabId) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tabId);
        router.replace(`/staff/admission/requests?${params.toString()}`);
    };

    const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
    const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
            <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-semibold text-gray-800">Requests Operations</h1>
                        {isLoadingRequests && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                    </div>
                    <p className="text-sm text-gray-500">Manage admission intake, verify certificates, and approve profile updates.</p>
                </div>
                <div>
                    <button
                        type="button"
                        onClick={() => router.push('/staff/admission/dashboard')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <span>&larr;</span> <span>Return to Dashboard</span>
                    </button>
                </div>
            </header>

            <section className="space-y-4">
                <RequestTabs 
                    activeTab={activeTab} 
                    onTabChange={handleTabChange}
                    badges={{
                        certificates: certificatePendingCount,
                        updates: profilePendingCount
                    }}
                />

                <div className="border border-gray-300 rounded-md bg-white p-4">
                    {activeTab === 'admissions' && <AdmissionRequestsPanel />}
                    {activeTab === 'certificates' && <CertificateRequestsPanel />}
                    {activeTab === 'updates' && <StudentUpdateRequestsPanel />}
                </div>
            </section>
        </div>
    );
}

export default function RequestsCenterPage() {
    return (
        <Suspense fallback={<LoadingSpinner label="Initializing Operations Center..." />}>
            <RequestsCenterContent />
        </Suspense>
    );
}
