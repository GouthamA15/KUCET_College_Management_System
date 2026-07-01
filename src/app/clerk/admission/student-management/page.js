'use client';

import { useClerk } from '@/context/ClerkContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ClerkStudentManagement from '@/components/ClerkStudentManagement';
import StudentHistoryCard from '@/components/clerk/student-management/StudentHistoryCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function StudentManagementPage() {
    const _router = useRouter();
    const { clerkData: clerk, loading: isLoading } = useClerk();

    if (isLoading && !clerk) {
        return <LoadingSpinner label="Opening Student Registry..." />;
    }

    if (!clerk) return null;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
            <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Student Registry</h1>
                    <p className="text-sm text-gray-600 mt-1">Manage admissions, student records and institutional operations.</p>
                </div>
                <Link
                    href="/clerk/admission/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                    <span>&larr;</span> Return to Dashboard
                </Link>
            </header>

            <section className="space-y-10">
                <ClerkStudentManagement />
                
                <div className="pt-6">
                  <StudentHistoryCard currentClerkId={clerk?.id} />
                </div>
            </section>
        </div>
    );
}
