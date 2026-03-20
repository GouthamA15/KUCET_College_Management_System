'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import ClerkStudentManagement from '@/components/ClerkStudentManagement';
import StudentHistoryCard from '@/components/clerk/student-management/StudentHistoryCard';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import toast from 'react-hot-toast';

function ClerkDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [openModule, setOpenModule] = useState(null);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600">Loading admission dashboard...</p>
      </div>
    );
  }

  if (!clerk) {
    // This case will be hit if loading is false but clerk is still null (e.g., due to an error and redirect)
    return null; 
  }
  
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Admission Clerk Dashboard</h1>

      {!openModule && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <div onClick={() => setOpenModule('student')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-indigo-50 rounded flex items-center justify-center">🎓</div>
              <div>
                <h3 className="font-semibold">Student Management</h3>
                <p className="text-sm text-gray-600">Add, fetch and edit students.</p>
              </div>
            </div>
          </div>

          <div onClick={() => setOpenModule('certificates')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-50 rounded flex items-center justify-center">📜</div>
              <div>
                <h3 className="font-semibold">Certificates</h3>
                <p className="text-sm text-gray-600">View and process student certificate requests.</p>
              </div>
            </div>
          </div>

          <div onClick={() => router.push('/clerk/admission/requests')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col border-t-4 border-purple-500">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-50 rounded flex items-center justify-center">📩</div>
              <div>
                <h3 className="font-semibold">Admission Requests</h3>
                <p className="text-sm text-gray-600">Verify new student applications.</p>
              </div>
            </div>
          </div>

          <div onClick={() => router.push('/clerk/admission/finalize')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col border-t-4 border-blue-500">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-50 rounded flex items-center justify-center">🆔</div>
              <div>
                <h3 className="font-semibold">Finalize Admissions</h3>
                <p className="text-sm text-gray-600">Assign roll numbers.</p>
              </div>
            </div>
          </div>

          <div onClick={() => router.push('/clerk/admission/student-requests')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-50 rounded flex items-center justify-center">✍️</div>
              <div>
                <h3 className="font-semibold">Update Requests</h3>
                <p className="text-sm text-gray-600">Approve profile updates.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {openModule==='student' && (
        <div className="mt-6">
          <button onClick={()=>setOpenModule(null)} className="text-sm text-indigo-600 mb-3">← Back to Dashboard</button>
          <div>
            <ClerkStudentManagement />
            <StudentHistoryCard currentClerkId={clerk?.id} />
          </div>
        </div>
      )}

      {openModule==='certificates' && (
        <div className="mt-6">
          <button onClick={()=>setOpenModule(null)} className="text-sm text-indigo-600 mb-3">← Back to Dashboard</button>
          <CertificateDashboard clerkType="admission" />
        </div>
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
