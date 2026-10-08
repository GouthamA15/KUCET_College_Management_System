'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import CertificateRequestsPanel from '@/components/staff/requests/CertificateRequestsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HodCertificateRequestsPage() {
    const router = useRouter();
    const { 
        staffData,
        loading
    } = useStaff();

    const isAuthorized = staffData && ((staffData.role === 'faculty' && staffData.is_hod) || staffData.role === 'admin');

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
        }
    }, [staffData, loading, router, isAuthorized]);

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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 min-h-[500px]">
                <CertificateRequestsPanel staffType="hod" />
            </div>
        </div>
    );
}
