"use client";

import { useEffect, useState, _useRef, Suspense } from 'react';
import { useClerk } from '@/context/ClerkContext';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import ScholarshipMetricsCards from '@/components/clerk/scholarship/ScholarshipMetricsCards';
import ScholarshipWindowCard from '@/components/clerk/scholarship/ScholarshipWindowCard';
import toast from 'react-hot-toast';
import { ClerkDashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { smoothScrollToId } from '@/lib/scroll-utils';
import { Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';



function ScholarshipDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clerkData: clerk, loading: isClerkLoading } = useClerk();

  const [view, setView] = useState('dashboard');

  const firstName = clerk?.name?.split(' ')[0] || 'Clerk';
  const employeeId = clerk?.employee_id || (clerk?.role ? String(clerk.role).toUpperCase() : 'SCHOLARSHIP');
  const _roleLabel = 'Scholarship Clerk';

  const _openProfile = () => {
    try {
      router.push('/clerk/scholarship/profile');
    } catch {
      // ignore
    }
  };

  const backToDashboard = () => {
    setView('dashboard');
    try {
      router.push('/clerk/scholarship/dashboard');
    } catch {
      // ignore
    }
  };

  // URL Parameter Handling: switch view and auto-scroll
  useEffect(() => {
    const v = searchParams.get('view');
    const scroll = searchParams.get('scroll');

    let viewTimer;
    let scrollTimer;

    if (v === 'requests' || v === 'certificates' || v === 'verification') {
      viewTimer = setTimeout(() => {
        setView('certificates');
      }, 0);

      if (scroll === '1') {
        scrollTimer = setTimeout(() => {
          smoothScrollToId('certificate-section', { behavior: 'smooth', block: 'start' });
        }, 800);
      }
    }

    return () => {
      if (viewTimer) clearTimeout(viewTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [searchParams]);

  const [metricsRefreshToken, setMetricsRefreshToken] = useState(0);

  useEffect(() => {
    if (!isClerkLoading && clerk && clerk.role !== 'scholarship') {
      toast.error('Access Denied');
    }
  }, [clerk, isClerkLoading]);


  if (isClerkLoading && !clerk) {
    return <ClerkDashboardSkeleton />;
  }

  if (!clerk) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
      {/* Welcome Banner */}
      <div id="scholarship-dashboard-top" className="relative bg-gradient-to-r from-[#002A5C] via-[#0b3578] to-[#002A5C] rounded-xl px-6 py-6 text-white shadow-md overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Soft decorative background shapes/patterns */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none opacity-40 z-0" />
        <div className="absolute left-10 -bottom-10 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Workspace Hero</p>
          <h1 className="text-2xl md:text-3xl font-normal tracking-tight">Welcome, {firstName}</h1>
          <p className="text-blue-100/90 text-xs font-medium tracking-wide mt-1">
            {employeeId} &bull; Scholarship Clerk
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          {view === 'certificates' ? (
            <button
              type="button"
              onClick={backToDashboard}
              className="px-5 py-2.5 bg-white text-[#002A5C] hover:bg-blue-50 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all cursor-pointer active:scale-98"
            >
              Back to Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                smoothScrollToId('search-section', { behavior: 'smooth', block: 'start' });
              }}
              className="px-5 py-2.5 bg-white text-[#002A5C] hover:bg-blue-50 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all cursor-pointer active:scale-98"
            >
              Open Scholarship Workspace
            </button>
          )}
        </div>
      </div>

      {view === 'certificates' ? (
        <section id="certificate-section" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Certificate Queue</h2>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Operational Module</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-3 sm:p-6">
            <CertificateDashboard clerkType="scholarship" />
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Operational Metrics</h2>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Live Status</span>
            </div>
            <ScholarshipMetricsCards refreshToken={metricsRefreshToken} />
          </section>

          <section id="search-section" className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Primary Operations</h2>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Search &bull; Window &bull; Queue</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <Link href="/clerk/scholarship/student-records" className="block h-full cursor-pointer hover:-translate-y-1 transition-transform group">
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 h-full flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
                        <Search size={24} className="text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Student Records</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        Search students and manage scholarship registry, institutional fees, and academic year records.
                      </p>
                    </div>
                    <div className="flex items-center text-indigo-600 text-sm font-semibold group-hover:text-indigo-700">
                      Open Workspace <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <ScholarshipWindowCard
                  onWindowUpdated={() => {
                    setMetricsRefreshToken((t) => t + 1);
                    smoothScrollToId('scholarship-dashboard-top', { behavior: 'smooth', block: 'start' });
                  }}
                />
              </div>
            </div>
          </section>
        </>
      )}
      {/* Image Preview intentionally removed to match removed StudentInfoCard */}
    </div>
  );
}

export default function ScholarshipDashboard() {
  return (
    <Suspense fallback={<ClerkDashboardSkeleton />}>
      <ScholarshipDashboardContent />
    </Suspense>
  );
}
