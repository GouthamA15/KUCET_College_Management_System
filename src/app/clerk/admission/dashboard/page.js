'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import ClerkStudentManagement from '@/components/ClerkStudentManagement';
import StudentHistoryCard from '@/components/clerk/student-management/StudentHistoryCard';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import toast from 'react-hot-toast';

function ClerkDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    clerkData: clerk, 
    loading: isLoading, 
    pendingProfileRequests, 
    pendingCertificateRequests,
    isLoadingRequests
  } = useClerk();
  const [openModule, setOpenModule] = useState(null);

  const firstName = clerk?.name?.split(' ')[0] || 'Clerk';
  const employeeLabel = clerk?.employee_id || (clerk?.role ? clerk.role.toUpperCase() : 'ADMISSION');
  const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
  const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;
  const totalPending = profilePendingCount + certificatePendingCount;

  useEffect(() => {
    const v = searchParams.get('view');
    const scroll = searchParams.get('scroll');
    
    if (v === 'requests' || v === 'certificates') {
      setOpenModule('certificates');
      
      if (scroll === '1') {
        const timer = setTimeout(() => {
          const el = document.getElementById('certificate-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading && !clerk) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-100 border-t-[#0b3578] rounded-full animate-spin"></div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Dashboard</span>
        </div>
      </div>
    );
  }

  if (!clerk) {
    // This case will be hit if loading is false but clerk is still null (e.g., due to an error and redirect)
    return null; 
  }
  
  const actionCards = [
    {
      key: 'student',
      label: 'Student Management',
      description: 'Onboard, edit, and validate student records.',
      icon: '🎓',
      tone: 'bg-indigo-50 text-indigo-700',
      accent: 'border-t-indigo-400',
      onClick: () => setOpenModule('student')
    },
    {
      key: 'certificates',
      label: 'Certificates',
      description: 'Clear certificate and ID requests quickly.',
      icon: '📜',
      tone: 'bg-emerald-50 text-emerald-700',
      accent: 'border-t-emerald-400',
      onClick: () => setOpenModule('certificates'),
      badge: certificatePendingCount
    },
    {
      key: 'requests',
      label: 'Admission Requests',
      description: 'Review new intake applications.',
      icon: '📩',
      tone: 'bg-purple-50 text-purple-700',
      accent: 'border-t-purple-400',
      onClick: () => router.push('/clerk/admission/requests')
    },
    {
      key: 'finalize',
      label: 'Finalize Admissions',
      description: 'Lock roll numbers for verified students.',
      icon: '🆔',
      tone: 'bg-blue-50 text-blue-700',
      accent: 'border-t-blue-400',
      onClick: () => router.push('/clerk/admission/finalize')
    },
    {
      key: 'updates',
      label: 'Update Requests',
      description: 'Approve profile change requests.',
      icon: '✍️',
      tone: 'bg-orange-50 text-orange-700',
      accent: 'border-t-orange-400',
      onClick: () => router.push('/clerk/admission/student-requests'),
      badge: profilePendingCount
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 animate-fadeIn font-sans antialiased text-slate-600">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5">
        <div className="space-y-1">
          <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.22em] opacity-90">Admission Command</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Welcome, {firstName}</h1>
          <div className="flex items-center gap-3 mt-2 text-slate-600">
            <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{employeeLabel}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs font-medium uppercase tracking-tight">Admission Clerk</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[9px] font-bold uppercase tracking-widest bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Queue {totalPending}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              Profiles {profilePendingCount}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest bg-rose-100 text-rose-800 px-2 py-1 rounded-full">
              Certificates {certificatePendingCount}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/clerk/admission/requests')}
          className="px-6 py-2.5 bg-[#0b3578] text-white text-[12px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-[#0b3578]/20 hover:scale-105 transition-all"
        >
          Open Intake Queue
        </button>
      </header>

      {!openModule && (
        <>
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Queue Pulse</h2>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {isLoadingRequests ? 'Updating queue' : 'Live status'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Queue</p>
                <p className="text-3xl font-semibold text-slate-800 mt-3">{totalPending}</p>
                <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">
                  {totalPending > 0 ? 'Action required' : 'Queue clear'}
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 border-l-4 border-l-amber-400 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Profile Updates</p>
                <p className="text-3xl font-semibold text-slate-800 mt-3">{profilePendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">
                  {profilePendingCount > 0 ? 'Awaiting review' : 'No pending edits'}
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 border-l-4 border-l-rose-400 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Certificate Queue</p>
                <p className="text-3xl font-semibold text-slate-800 mt-3">{certificatePendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">
                  {certificatePendingCount > 0 ? 'Pending approvals' : 'No requests'}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Workstreams</h2>
              <button
                type="button"
                onClick={() => router.push('/clerk/admission/student-requests')}
                className="text-[10px] font-semibold text-[#0b3578] hover:underline uppercase tracking-wider"
              >
                View profile queue
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {actionCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  aria-label={`Open ${card.label}`}
                  className={`text-left bg-white p-6 rounded-2xl border border-slate-200 border-t-4 ${card.accent} shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all group`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${card.tone}`}>{card.icon}</div>
                    {card.badge > 0 && (
                      <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded-full uppercase tracking-widest">
                        {card.badge} Pending
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-base font-semibold text-slate-900 tracking-tight group-hover:text-[#0b3578] transition-colors">
                        {card.label}
                      </h3>
                      <span className="text-[10px] font-bold text-[#0b3578] uppercase tracking-widest group-hover:underline">
                        Open →
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {openModule && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Module</p>
              <h2 className="text-xl font-bold text-slate-800 mt-1">
                {openModule === 'student' ? 'Student Management' : 'Certificate Requests'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {openModule === 'student' 
                  ? 'Manage student records and review recent edits.'
                  : 'Approve or reject certificate requests submitted by students.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenModule(null)}
              className="text-[10px] font-semibold text-[#0b3578] uppercase tracking-wider hover:underline"
            >
              Back to Dashboard
            </button>
          </div>

          {openModule === 'student' && (
            <div className="space-y-6">
              <ClerkStudentManagement />
              <StudentHistoryCard currentClerkId={clerk?.id} />
            </div>
          )}

          {openModule === 'certificates' && (
            <CertificateDashboard clerkType="admission" />
          )}
        </section>
      )}
    </div>
  );
}

export default function ClerkDashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] p-6 text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Admission Dashboard...</div>}>
      <ClerkDashboardContent />
    </Suspense>
  );
}
