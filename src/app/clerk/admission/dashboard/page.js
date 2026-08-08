'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import toast from 'react-hot-toast';
import { ClerkDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

function ClerkDashboardContent() {
  const router = useRouter();
  const { 
    clerkData: clerk, 
    loading: isLoading, 
    pendingProfileRequests, 
    pendingCertificateRequests,
    isLoadingRequests,
    studentHistory
  } = useClerk();

  const firstName = clerk?.name?.split(' ')[0] || 'Clerk';
  const employeeLabel = clerk?.employee_id || (clerk?.role ? clerk.role.toUpperCase() : 'ADMISSION');
  const profilePendingCount = Array.isArray(pendingProfileRequests) ? pendingProfileRequests.length : 0;
  const certificatePendingCount = Array.isArray(pendingCertificateRequests) ? pendingCertificateRequests.length : 0;
  const totalPending = profilePendingCount + certificatePendingCount;

  const completedTodayCount = useMemo(() => {
    if (!studentHistory?.records) return 0;
    const todayStr = new Date().toDateString();
    return studentHistory.records.filter(r => {
      if (!r.actionTime) return false;
      return new Date(r.actionTime).toDateString() === todayStr;
    }).length;
  }, [studentHistory]);

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading && !clerk) {
    return <ClerkDashboardSkeleton />;
  }

  if (!clerk) return null;
  
  const actionCards = [
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
      key: 'combined-requests',
      label: 'Certificates & Requests',
      description: 'Approve profile changes and certificate requests.',
      icon: '📑',
      tone: 'bg-emerald-50 text-emerald-700',
      accent: 'border-t-emerald-400',
      path: profilePendingCount > certificatePendingCount ? '/clerk/admission/requests?tab=updates' : '/clerk/admission/requests?tab=certificates',
      badge: profilePendingCount + certificatePendingCount
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 md:px-8 animate-fadeIn font-sans antialiased text-gray-600">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-[#002A5C] via-[#0b3578] to-[#002A5C] rounded-md px-6 py-6 text-white shadow-sm overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Soft decorative background shapes/patterns */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none opacity-40 z-0" />
        <div className="absolute left-10 -bottom-10 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <p className="text-blue-200 text-sm font-medium ">Workspace Hero</p>
          <h1 className="text-2xl md:text-3xl font-normal tracking-tight">Welcome, {firstName}</h1>
          <p className="text-blue-100/90 text-xs font-medium mt-1">
            {employeeLabel} &bull; Admission Clerk
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/clerk/admission/requests')}
            className="px-5 py-2.5 bg-white text-[#002A5C] hover:bg-blue-50 text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all cursor-pointer active:scale-98"
          >
            Open Operational Queue
          </button>
        </div>
      </div>

      {/* Operational Metrics */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-gray-700 tracking-[0.2em]">Operational Metrics</h2>
          <span className="text-sm font-medium text-gray-500 ">
            {isLoadingRequests ? 'Syncing...' : 'Live Status'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Pending Requests Card */}
          <button
            type="button"
            onClick={() => router.push('/clerk/admission/requests')}
            className="group text-left bg-white py-4 px-5 rounded-md border border-gray-200 border-l-4 border-l-amber-500 shadow-sm flex flex-col justify-between h-24 transition-all hover:shadow-sm cursor-pointer"
          >
            <p className="text-sm font-medium text-gray-400 ">Total Pending Requests</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-semibold tracking-tight text-gray-800">
                {totalPending}
              </span>
              <span className="text-xs font-medium text-gray-400 ">Requests</span>
            </div>
          </button>

          {/* Profile Updates Card */}
          <button
            type="button"
            onClick={() => router.push('/clerk/admission/requests?tab=updates')}
            className="group text-left bg-white py-4 px-5 rounded-md border border-gray-200 border-l-4 border-l-orange-500 shadow-sm flex flex-col justify-between h-24 transition-all hover:shadow-sm cursor-pointer"
          >
            <p className="text-sm font-medium text-gray-400 ">Profile Updates</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-semibold tracking-tight text-gray-800">
                {profilePendingCount}
              </span>
              <span className="text-xs font-medium text-gray-400 ">Updates</span>
            </div>
          </button>

          {/* Certificate Requests Card */}
          <button
            type="button"
            onClick={() => router.push('/clerk/admission/requests?tab=certificates')}
            className="group text-left bg-white py-4 px-5 rounded-md border border-gray-200 border-l-4 border-l-blue-600 shadow-sm flex flex-col justify-between h-24 transition-all hover:shadow-sm cursor-pointer"
          >
            <p className="text-sm font-medium text-gray-400 ">Certificate Requests</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-semibold tracking-tight text-gray-800">
                {certificatePendingCount}
              </span>
              <span className="text-xs font-medium text-gray-400 ">Requests</span>
            </div>
          </button>

          {/* Completed Today Card */}
          <div
            className="bg-white py-4 px-5 rounded-md border border-gray-200 border-l-4 border-l-emerald-500 shadow-sm flex flex-col justify-between h-24"
          >
            <p className="text-sm font-medium text-gray-400 ">Completed Today</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-semibold tracking-tight text-gray-800">
                {completedTodayCount}
              </span>
              <span className="text-xs font-medium text-gray-400 ">Processed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Operations */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-gray-700 tracking-[0.2em]">Primary Operations</h2>
          <p className="text-sm font-medium text-gray-400 ">Select an operational module</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {actionCards.map((card) => {
            const sweepColorMap = {
              'border-t-indigo-400': 'bg-indigo-500',
              'border-t-emerald-400': 'bg-emerald-500',
              'border-t-purple-400': 'bg-purple-500',
              'border-t-blue-400': 'bg-blue-500',
              'border-t-orange-400': 'bg-orange-500'
            };
            const sweepColor = sweepColorMap[card.accent] || 'bg-blue-600';

            return (
              <button
                key={card.key}
                type="button"
                onClick={() => router.push(card.path)}
                className="group text-left bg-white p-5 rounded-md border border-gray-200 shadow-sm hover:shadow-sm transition-all duration-300 hover:scale-[1.02] relative overflow-hidden h-36 flex flex-col justify-between cursor-pointer"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gray-100 overflow-hidden">
                  <div className={`h-full ${sweepColor} w-0 group-hover:w-full transition-all duration-500 ease-out`} />
                </div>

                <div className="flex items-start justify-between w-full relative z-10">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${card.tone} shadow-sm border border-black/5`}>
                    {card.icon}
                  </div>
                  {card.badge > 0 && (
                    <span className="text-xs font-medium text-white bg-rose-600 px-2.5 py-1 rounded-full shadow-sm">
                      {card.badge} Action
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 relative z-10">
                  <h3 className="text-base font-medium text-gray-800 transition-colors">
                    {card.label}
                  </h3>
                  <p className="text-sm text-gray-500 tracking-tight opacity-75">{card.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function ClerkDashboard() {
  return (
    <Suspense fallback={<ClerkDashboardSkeleton />}>
      <ClerkDashboardContent />
    </Suspense>
  );
}
