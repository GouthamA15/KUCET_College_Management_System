'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import CertificateRequestsPanel from '@/components/staff/requests/CertificateRequestsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HodCertificateRequestsPage() {
    const router = useRouter();
    const { 
        staffData,
        loading,
        pendingCertificateRequests,
        isLoadingRequests,
        refreshCertificateRequests
    } = useStaff();

    const isAuthorized = staffData && ((staffData.role === 'faculty' && staffData.is_hod) || staffData.role === 'admin');
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!loading) {
            if (!staffData) {
                router.replace('/staff/login');
                return;
            }

            // Must be an active HOD
            if (!isAuthorized) {
                router.replace('/staff/faculty/academics');
                return;
            }

            if (!fetchedRef.current) {
                fetchedRef.current = true;
                refreshCertificateRequests('hod');
            }
        }
    }, [staffData, loading, router, refreshCertificateRequests, isAuthorized]);

    if (loading || !isAuthorized) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <LoadingSpinner />
                <span className="ml-3 text-gray-600 font-medium">Checking authorization...</span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Department Certificate Requests</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Review and approve Internship and No Objection Certificates for your department.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                {isLoadingRequests && !pendingCertificateRequests?.length ? (
                    <div className="flex h-64 items-center justify-center">
                        <LoadingSpinner />
                        <span className="ml-3 text-gray-600">Loading requests...</span>
                    </div>
                ) : (
                    <CertificateRequestsPanel 
                        requests={pendingCertificateRequests} 
                        staffType="hod" 
                        onRefresh={() => refreshCertificateRequests('hod')} 
                    />
                )}
            </div>
        </div>
    );
}
