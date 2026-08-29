'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import toast from 'react-hot-toast';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export default function AdmissionDashboardClient() {
  const router = useRouter();
  const { 
    staffData: staff, 
    loading: isLoading, 
    pendingProfileRequests, 
    pendingCertificateRequests,
    isLoadingRequests,
    studentHistory,
    refreshStudentHistory,
    refreshProfileRequests,
    refreshCertificateRequests
  } = useStaff();

  const firstName = staff?.name?.split(' ')[0] || 'Staff';
  const employeeLabel = staff?.employee_id || (staff?.role ? staff.role.toUpperCase() : 'ADMISSION');
  const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
  const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;
  const totalPending = profilePendingCount + certificatePendingCount;

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (staff?.role === 'admission' && !fetchedRef.current) {
      fetchedRef.current = true;
      refreshStudentHistory('my');
      refreshProfileRequests();
      refreshCertificateRequests('admission');
    }
  }, [staff?.role, refreshStudentHistory, refreshProfileRequests, refreshCertificateRequests]);

  const completedTodayCount = useMemo(() => {
    if (!studentHistory?.records) return 0;
    const todayStr = new Date().toDateString();
    return studentHistory.records.filter(r => {
      if (!r.actionTime) return false;
      return new Date(r.actionTime).toDateString() === todayStr;
    }).length;
  }, [studentHistory]);

  useEffect(() => {
    if (!isLoading && staff && staff.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [staff, isLoading]);

  if (isLoading && !staff) {
    return <StaffDashboardSkeleton />;
  }

  if (!staff) return null;
  
  const actionCards = [
    {
      key: 'requests',
      label: 'Admission Intake',
      description: 'Review new intake applications.',
      icon: '📩',
      tone: 'bg-purple-50 text-purple-700',
      path: '/staff/admission/requests?tab=admissions',
      badge: 0
    },
    {
      key: 'finalize',
      label: 'Finalize Admissions',
      description: 'Lock roll numbers for verified students.',
      icon: '🆔',
      tone: 'bg-blue-50 text-blue-700',
      path: '/staff/admission/finalize',
      badge: 0
    },
    {
      key: 'combined-requests',
      label: 'Certificates & Requests',
      description: 'Approve profile changes and certificate requests.',
      icon: '📑',
      tone: 'bg-emerald-50 text-emerald-700',
      path: profilePendingCount > certificatePendingCount ? '/staff/admission/requests?tab=updates' : '/staff/admission/requests?tab=certificates',
      badge: profilePendingCount + certificatePendingCount
    }
  ];

  const metricCards = [
    {
      key: 'pending',
      label: 'Total Pending',
      value: totalPending,
      hint: 'Requests',
      accent: 'border-l-amber-500',
      onClick: () => router.push('/staff/admission/requests')
    },
    {
      key: 'profile',
      label: 'Profile Updates',
      value: profilePendingCount,
      hint: 'Updates',
      accent: 'border-l-orange-500',
      onClick: () => router.push('/staff/admission/requests?tab=updates')
    },
    {
      key: 'certificate',
      label: 'Certificate Requests',
      value: certificatePendingCount,
      hint: 'Requests',
      accent: 'border-l-blue-600',
      onClick: () => router.push('/staff/admission/requests?tab=certificates')
    },
    {
      key: 'today',
      label: 'Completed Today',
      value: completedTodayCount,
      hint: 'Processed',
      accent: 'border-l-emerald-500',
      onClick: () => router.push('/staff/admission/dashboard')
    }
  ];

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-slate-50 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full lg:min-h-0 px-4 lg:px-8 py-4 lg:py-3 animate-fadeIn antialiased text-slate-700 flex flex-col gap-4 lg:gap-3">
        <header className="relative shrink-0 h-auto p-5 lg:px-6 lg:py-5 flex items-center overflow-hidden rounded-xl lg:rounded-sm border border-slate-200/80 bg-[#0b3578] shadow-inner">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b3578] via-[#0f3d8a] to-[#1d57b8]" />
            <div
              className="absolute -right-10 -top-10 w-72 h-72 rounded-full opacity-25 mix-blend-screen transition-all duration-1000"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }}
            />
            <div
              className="absolute right-1/3 -bottom-20 w-96 h-96 rounded-full opacity-20 mix-blend-screen"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)' }}
            />
            <div className="absolute right-[8%] top-[12%] w-14 h-14 rounded-full bg-white/10 backdrop-blur-[1px] border border-white/20 shadow-[0_8px_32px_0_rgba(255,255,255,0.05)]" />
            <div className="absolute right-[18%] bottom-[-10%] w-20 h-20 rounded-full bg-white/5 backdrop-blur-[2px] border border-white/10 shadow-[0_8px_32px_0_rgba(255,255,255,0.03)]" />
            <div className="absolute right-[28%] top-[35%] w-8 h-8 rounded-full bg-white/10 backdrop-blur-[1px] border border-white/25 shadow-[0_8px_32px_0_rgba(255,255,255,0.05)]" />
            <div className="absolute right-[3%] bottom-[30%] w-10 h-10 rounded-full bg-white/5 backdrop-blur-[1px] border border-white/10 shadow-[0_8px_32px_0_rgba(255,255,255,0.03)]" />
          </div>

          <div className="relative w-full p-0">
            <div className="lg:hidden flex flex-col justify-between gap-2.5">
              <div className="space-y-1 text-left text-white">
                <h1 className="text-2xl font-bold tracking-tight text-white leading-tight select-none">
                  Welcome, {firstName}
                </h1>
                <div className="flex flex-wrap items-center justify-start gap-2 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full">
                    {employeeLabel}
                  </span>
                  <span className="text-blue-200/50 inline">•</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-100/90">
                    Admission Staff
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:block text-left text-white">
              <h1 className="text-2xl font-bold tracking-tight text-white select-none">
                Welcome back, {firstName}
              </h1>
              <div className="mt-2 text-xs font-medium text-blue-100/90 space-y-0.5 select-none">
                <div>{employeeLabel}</div>
                <div>Admission Team</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:flex lg:flex-col lg:gap-3 lg:flex-1 lg:min-h-0">
          <div className="order-1 lg:order-none lg:contents flex flex-col gap-4 lg:gap-3 lg:min-h-0">
            <div className="lg:order-1 lg:shrink-0 lg:min-h-0 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <section className="rounded-sm border border-slate-200 bg-white overflow-hidden">
                <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 lg:py-2 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold text-slate-700 lg:text-slate-700 uppercase tracking-[0.20em]">Priority Actions</h2>
                  <button
                    type="button"
                    onClick={() => router.push('/staff/admission/requests')}
                    className="text-[9px] font-bold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest"
                  >
                    Open Queue
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {actionCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => router.push(card.path)}
                      className="group w-full text-left rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-200 hover:bg-white hover:shadow-sm flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-base ${card.tone}`}>
                          {card.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[13px] font-bold text-slate-800 leading-tight tracking-tight truncate">
                            {card.label}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {card.badge > 0 && (
                          <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            {card.badge}
                          </span>
                        )}
                        <svg
                          className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:order-2 lg:shrink-0">
              <section className="rounded-sm border border-slate-200 bg-white overflow-hidden">
                <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold text-slate-700 lg:text-slate-700 uppercase tracking-[0.20em]">Operations Snapshot</h2>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {isLoadingRequests ? 'Syncing...' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3">
                  {metricCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={card.onClick}
                      className={`group text-left bg-white py-4 px-4 rounded-md border border-gray-200 ${card.accent} shadow-sm flex flex-col justify-between h-24 transition-all hover:shadow-sm cursor-pointer`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-slate-600">{card.label}</p>
                        <svg
                          className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-2xl font-semibold tracking-tight text-gray-800">{card.value}</span>
                        <span className="hidden sm:inline text-[9px] font-medium text-slate-500">{card.hint}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="order-2 lg:order-none lg:contents flex flex-col gap-4 lg:gap-3 lg:min-h-0">
            <div className="lg:order-2 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
              <section className="rounded-sm border border-slate-200 bg-white overflow-hidden">
                <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold text-[#0b3578] lg:text-slate-500 uppercase tracking-[0.20em]">Today at a glance</h2>
                  <button
                    type="button"
                    onClick={() => router.push('/staff/admission/dashboard')}
                    className="text-[9px] font-bold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest"
                  >
                    Refresh
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.18em]">Completed Today</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-3xl font-bold text-slate-800">{completedTodayCount}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Processed</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">Current focus</p>
                    <p className="mt-2 text-[12px] text-slate-600 leading-relaxed">
                      {totalPending > 0
                        ? `There are ${totalPending} pending items in the admission queue that need review.`
                        : 'The admission queue is clear. No pending items are waiting for action.'}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <section className="order-2 lg:order-3 lg:shrink-0 rounded-sm border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.20em]">Support</p>
              <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
                Coordinate with the admissions office during working hours to resolve fast-track requests and student verification tasks.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
