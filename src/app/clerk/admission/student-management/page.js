'use client';

import { useClerk } from '@/context/ClerkContext';
import { useRouter } from 'next/navigation';
import ClerkStudentManagement from '@/components/ClerkStudentManagement';
import StudentHistoryCard from '@/components/clerk/student-management/StudentHistoryCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function StudentManagementPage() {
    const router = useRouter();
    const { clerkData: clerk, loading: isLoading } = useClerk();

    if (isLoading && !clerk) {
        return <LoadingSpinner label="Opening Student Registry..." />;
    }

    if (!clerk) return null;

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased">
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5">
                <div className="space-y-1 pb-4">
                    <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.25em] opacity-90">Registry Command</p>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase">Student Management</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Onboard, Edit, and Audit Institutional Records</p>
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

            <section className="space-y-10">
                <ClerkStudentManagement />
                
                <div className="pt-6">
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Operational History</h2>
                    <div className="flex-1 h-px bg-slate-100"></div>
                  </div>
                  <StudentHistoryCard currentClerkId={clerk?.id} />
                </div>
            </section>
        </div>
    );
}
