'use client';
import { useState, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import ClerkStudentManagement from '@/components/ClerkStudentManagement';
import StudentHistoryCard from '@/components/clerk/student-management/StudentHistoryCard';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import toast from 'react-hot-toast';

export default function ClerkDashboard() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [openModule, setOpenModule] = useState(null);

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'admission') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading admission dashboard...</p>
      </div>
    );
  }

  if (!clerk) {
    // This case will be hit if loading is false but clerk is still null (e.g., due to an error and redirect)
    return null; 
  }
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar clerkMode={true} />
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Admission Clerk Dashboard</h1>

        {!openModule && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            
            <div className="opacity-60 pointer-events-none bg-white p-4 rounded-lg shadow flex flex-col">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">📈</div>
                <div>
                  <h3 className="font-semibold">Reports</h3>
                  <p className="text-sm text-gray-500">Disabled — Coming Soon</p>
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
        
      </main>
      <Footer />
    </div>
  );
}