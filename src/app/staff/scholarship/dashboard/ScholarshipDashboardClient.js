'use client';

import { useEffect, useState } from 'react';
import { useStaff } from '@/context/StaffContext';
import { useRouter, useSearchParams } from 'next/navigation';
import CertificateDashboard from '@/components/staff/certificates/CertificateDashboard';
import ScholarshipMetricsCards from '@/components/staff/scholarship/ScholarshipMetricsCards';
import ScholarshipWindowCard from '@/components/staff/scholarship/ScholarshipWindowCard';
import toast from 'react-hot-toast';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { smoothScrollToId } from '@/lib/scroll-utils';
export default function ScholarshipDashboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { staffData: staff, loading: isStaffLoading } = useStaff();

  const [view, setView] = useState('dashboard');

  const firstName = staff?.name?.split(' ')[0] || 'Staff';
  const employeeId = staff?.employee_id || (staff?.role ? String(staff.role).toUpperCase() : 'SCHOLARSHIP');

  const actionCards = [
    {
      key: 'records',
      label: 'Student Records',
      description: 'Search students and manage scholarship registry details.',
      icon: '📚',
      tone: 'bg-indigo-50 text-indigo-700',
      path: '/staff/scholarship/student-records',
      badge: 0,
    },
    {
      key: 'window',
      label: 'Submission Window',
      description: 'Configure active scholarship application periods.',
      icon: '🗓️',
      tone: 'bg-amber-50 text-amber-700',
      path: '/staff/scholarship/dashboard',
      badge: 0,
    },
    {
      key: 'certificates',
      label: 'Certificate Queue',
      description: 'Review scholarship certificate requests and verifications.',
      icon: '📑',
      tone: 'bg-emerald-50 text-emerald-700',
      path: '/staff/scholarship/dashboard?view=certificates',
      badge: 0,
    },
  ];

  const backToDashboard = () => {
    setView('dashboard');
    try {
      router.push('/staff/scholarship/dashboard');
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
    if (!isStaffLoading && staff && staff.role !== 'scholarship') {
      toast.error('Access Denied');
    }
  }, [staff, isStaffLoading]);

  if (isStaffLoading && !staff) {
    return <StaffDashboardSkeleton />;
  }

  if (!staff) return null;

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-slate-50 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full lg:min-h-0 px-4 lg:px-8 py-4 lg:py-3 animate-fadeIn antialiased text-slate-700 flex flex-col gap-4 lg:gap-3">
        <header id="scholarship-dashboard-top" className="relative shrink-0 h-auto p-5 lg:px-6 lg:py-5 flex items-center overflow-hidden rounded-xl lg:rounded-sm border border-slate-200/80 bg-[#0b3578] shadow-inner">
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
                    {employeeId}
                  </span>
                  <span className="text-blue-200/50 inline">•</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-100/90">
                    Scholarship Staff
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:block text-left text-white">
              <h1 className="text-2xl font-bold tracking-tight text-white select-none">
                Welcome back, {firstName}
              </h1>
              <div className="mt-2 text-xs font-medium text-blue-100/90 space-y-0.5 select-none">
                <div>{employeeId}</div>
                <div>Scholarship Team</div>
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
                    onClick={() => router.push('/staff/scholarship/dashboard?view=certificates')}
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
                      onClick={() => {
                        if (card.key === 'window') {
                          smoothScrollToId('scholarship-window-card', { behavior: 'smooth', block: 'start' });
                          return;
                        }
                        router.push(card.path);
                      }}
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
              <section id="scholarship-window-card" className="rounded-sm border border-slate-200 bg-white overflow-hidden">
                <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold text-slate-700 lg:text-slate-700 uppercase tracking-[0.20em]">Operations Snapshot</h2>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {isStaffLoading ? 'Syncing...' : ''}
                  </span>
                </div>

                <div className="p-3">
                  <ScholarshipMetricsCards refreshToken={metricsRefreshToken} />
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
                    onClick={() => setMetricsRefreshToken((t) => t + 1)}
                    className="text-[9px] font-bold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest"
                  >
                    Refresh
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">Current focus</p>
                    <p className="mt-2 text-[12px] text-slate-600 leading-relaxed">
                      Scholarship operations are actively monitored for application review, student verification, and submission window management.
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-4">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.18em]">Window status</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-slate-800">Live</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Open for review</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

          </div>
        </div>

        {view === 'certificates' && (
          <section id="certificate-section" className="mt-3 rounded-sm border border-slate-200 bg-white overflow-hidden">
            <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
              <h2 className="text-[10px] font-bold text-slate-700 lg:text-slate-700 uppercase tracking-[0.20em]">Certificate Queue</h2>
              <button
                type="button"
                onClick={backToDashboard}
                className="text-[9px] font-bold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest"
              >
                Back to Dashboard
              </button>
            </div>
            <div className="p-3 sm:p-6">
              <CertificateDashboard staffType="scholarship" />
            </div>
          </section>
        )}

        {view !== 'certificates' && (
          <section className="rounded-sm border border-slate-200 bg-white overflow-hidden">
            <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-blue-200 lg:border-slate-300 flex items-center justify-between shrink-0">
              <h2 className="text-[10px] font-bold text-slate-700 lg:text-slate-700 uppercase tracking-[0.20em]">Submission Window</h2>
            </div>
            <div className="p-3">
              <ScholarshipWindowCard
                onWindowUpdated={() => {
                  setMetricsRefreshToken((t) => t + 1);
                  smoothScrollToId('scholarship-dashboard-top', { behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
          </section>
        )}

        <section className="rounded-sm border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.20em]">Support</p>
          <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
            Coordinate with the scholarship office during working hours to resolve document checks, verification backlogs, and submission window updates.
          </p>
        </section>
      </div>
    </div>
  );
}
