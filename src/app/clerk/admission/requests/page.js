'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import RequestTabs from '@/components/clerk/requests/RequestTabs';
import AdmissionRequestsPanel from '@/components/clerk/requests/AdmissionRequestsPanel';
import CertificateRequestsPanel from '@/components/clerk/requests/CertificateRequestsPanel';
import StudentUpdateRequestsPanel from '@/components/clerk/requests/StudentUpdateRequestsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function RequestsCenterContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { 
        pendingProfileRequests, 
        pendingCertificateRequests,
        isLoadingRequests 
    } = useClerk();

    const activeTab = searchParams.get('tab') || 'admissions';

    const handleTabChange = (tabId) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tabId);
        router.replace(`/clerk/admission/requests?${params.toString()}`);
    };

    const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
    const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased">
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5">
                <div className="space-y-1 pb-4">
                    <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.25em] opacity-90">Operational Command</p>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase">Request Operations Center</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                        Institutional Verification & Approval Hub
                        {isLoadingRequests && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                    </p>
                </div>
                <div className="flex items-center gap-3 pb-4">
                    <button
                        type="button"
                        onClick={() => router.push('/clerk/admission/dashboard')}
                        className="px-6 py-2 border-2 border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all shadow-sm"
                    >
                        ← Return to Dashboard
                    </button>
                </div>
            </header>

            <section className="space-y-8">
                <RequestTabs 
                    activeTab={activeTab} 
                    onTabChange={handleTabChange}
                    badges={{
                        certificates: certificatePendingCount,
                        updates: profilePendingCount
                    }}
                />

                <div className="min-h-[400px]">
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
