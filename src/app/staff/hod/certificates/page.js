'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import CertificateRequestsPanel from '@/components/staff/requests/CertificateRequestsPanel';

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
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
                <div>
                    <div className="h-8 bg-gray-200 rounded-md w-64 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-96"></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 min-h-[500px]">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                        <div className="flex gap-4">
                            <div className="h-8 bg-gray-200 rounded-full w-24"></div>
                        </div>
                        <div className="flex gap-3 w-full xl:w-auto">
                            <div className="h-10 bg-gray-200 rounded-md w-full sm:w-64"></div>
                            <div className="h-10 bg-gray-200 rounded-md w-24"></div>
                            <div className="h-10 bg-gray-200 rounded-md w-24"></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-12 bg-gray-100 rounded-md"></div>
                        <div className="h-16 bg-gray-50 rounded-md"></div>
                        <div className="h-16 bg-gray-50 rounded-md"></div>
                        <div className="h-16 bg-gray-50 rounded-md"></div>
                    </div>
                </div>
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
