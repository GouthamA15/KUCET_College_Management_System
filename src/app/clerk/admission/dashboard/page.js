'use client';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function ClerkDashboardContent() {
  const router = useRouter();
  const { 
    clerkData: clerk, 
    loading: isLoading, 
    pendingProfileRequests, 
    pendingCertificateRequests,
    isLoadingRequests
  } = useClerk();

  const firstName = clerk?.name?.split(' ')[0] || 'Clerk';
  const employeeLabel = clerk?.employee_id || (clerk?.role ? clerk.role.toUpperCase() : 'ADMISSION');
  const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
  const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;
  const totalPending = profilePendingCount + certificatePendingCount;

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading && !clerk) {
    return <LoadingSpinner label="Loading Dashboard" />;
  }

  if (!clerk) return null;
  
  const actionCards = [
    {
      key: 'student',
      label: 'Student Management',
      description: 'Onboard, edit, and validate student records.',
      icon: '🎓',
      tone: 'bg-indigo-50 text-indigo-700',
      accent: 'border-t-indigo-400',
      path: '/clerk/admission/student-management'
    },
    {
      key: 'certificates',
      label: 'Certificates',
      description: 'Clear certificate and ID requests quickly.',
      icon: '📜',
      tone: 'bg-emerald-50 text-emerald-700',
      accent: 'border-t-emerald-400',
      path: '/clerk/admission/requests?tab=certificates',
      badge: certificatePendingCount
    },
    {
      key: 'requests',
      label: 'Admission Intake',
      description: 'Review new intake applications.',
      icon: '📩',
      tone: 'bg-purple-50 text-purple-700',
      accent: 'border-t-purple-400',
      path: '/clerk/admission/requests?tab=admissions'
    },
    {
      key: 'finalize',
      label: 'Finalize Admissions',
      description: 'Lock roll numbers for verified students.',
      icon: '🆔',
      tone: 'bg-blue-50 text-blue-700',
      accent: 'border-t-blue-400',
      path: '/clerk/admission/finalize'
    },
    {
      key: 'updates',
      label: 'Update Requests',
      description: 'Approve profile change requests.',
      icon: '✍️',
      tone: 'bg-orange-50 text-orange-700',
      accent: 'border-t-orange-400',
      path: '/clerk/admission/requests?tab=updates',
      badge: profilePendingCount
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5 pb-4">
        <div className="space-y-1">
          <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.22em] opacity-90">Admission Command</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase">Welcome, {firstName}</h1>
          <div className="flex items-center gap-3 mt-2 text-slate-600">
            <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{employeeLabel}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs font-medium uppercase tracking-tight">Institutional Admission Clerk</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/clerk/admission/requests')}
          className="px-6 py-2.5 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest rounded-sm shadow-lg shadow-blue-100 hover:scale-105 transition-all active:scale-95"
        >
          Open Operational Queue
        </button>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Queue Pulse</h2>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {isLoadingRequests ? 'Syncing...' : 'Live System Status'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-sm border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Queue</p>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-black text-slate-800">{totalPending}</p>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items pending</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-sm border border-slate-200 border-l-4 border-l-amber-400 shadow-sm flex flex-col justify-between h-32">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profile Modifications</p>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-black text-slate-800">{profilePendingCount}</p>
              <button 
                onClick={() => router.push('/clerk/admission/requests?tab=updates')}
                className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1 hover:underline"
              >
                View Workspace →
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-sm border border-slate-200 border-l-4 border-l-rose-400 shadow-sm flex flex-col justify-between h-32">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Certificate Requests</p>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-black text-slate-800">{certificatePendingCount}</p>
              <button 
                onClick={() => router.push('/clerk/admission/requests?tab=certificates')}
                className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mb-1 hover:underline"
              >
                View Workspace →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Workstreams</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select an operational module</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {actionCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => router.push(card.path)}
              className={`text-left bg-white p-6 rounded-sm border border-slate-200 border-t-4 ${card.accent} shadow-sm hover:shadow-md transition-all group relative overflow-hidden h-44 flex flex-col justify-between`}
            >
              <div className="flex items-start justify-between relative z-10">
                <div className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl ${card.tone} shadow-sm border border-black/5`}>
                  {card.icon}
                </div>
                {card.badge > 0 && (
                  <span className="text-[9px] font-black text-white bg-rose-600 px-2.5 py-1 rounded-full uppercase tracking-[0.1em] shadow-sm">
                    {card.badge} Action
                  </span>
                )}
              </div>
              
              <div className="mt-4 space-y-1 relative z-10">
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase group-hover:text-[#0b3578] transition-colors">
                  {card.label}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80">{card.description}</p>
              </div>

              <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                <span className="text-[10px] font-black text-[#0b3578] uppercase tracking-widest flex items-center gap-1">
                  Launch Module <span className="text-sm">→</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ClerkDashboard() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading Admission Dashboard..." />}>
      <ClerkDashboardContent />
    </Suspense>
  );
}
