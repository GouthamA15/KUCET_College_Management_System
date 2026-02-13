'use client';

import { useState, useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';
import Navbar from '../../../../components/Navbar';
import DuesSection from '../../../../components/DuesSection';
import TuitionFeeStatus from '../../../../components/TuitionFeeStatus';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function NoDuesRequestPage() {
  const router = useRouter();

  const { studentData, loading, refreshData } = useStudent();
  const [requestStatus, setRequestStatus] = useState('idle');
  // Mock totalExpectedFee for demonstration.
  // In a real application, this should be dynamically calculated based on student's course, admission type, scholarship, etc.
  const [totalExpectedFee, setTotalExpectedFee] = useState(0); 


  useEffect(() => {
    if (loading) return;
    if (!studentData) return;

    // Route-level guard: block unverified accounts from accessing requests
    const s = studentData.student;
    const verified = !!(s?.email) && !!(s?.is_email_verified) && !!(s?.password_hash);
    if (!verified) {
      router.replace('/student/requests/verification-required');
      return;
    }

    // TODO: Implement actual logic to calculate totalExpectedFee
    setTotalExpectedFee(250000); // Placeholder value for total expected fee
  }, [studentData, loading, router]);

  const totalClearedFee = studentData?.fees?.reduce((acc, fee) => acc + fee.amount, 0) || 0;
  const pendingFee = totalExpectedFee - totalClearedFee;
  const hasPendingDues = pendingFee > 0;


  const handleRequest = () => {
    if (hasPendingDues) {
      toast.error('You have pending dues. Please clear them to proceed.');
      return;
    }
    setRequestStatus('pending');
    toast.success('No Dues Request initiated!');
    // Here you would typically make an API call to start the no-dues process.
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        studentProfileMode={true} 
        isSubPage={true}
        activeTab="requests"
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          router.replace('/');
        }}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">No Dues Certificate</h1>

        {loading ? (
          <p>Loading your dues status...</p>
        ) : (
          <>
            {studentData && (
              <TuitionFeeStatus 
                fees={studentData.fees} 
                academicYear={studentData.student?.academic_year} 
                totalExpectedFee={totalExpectedFee} // Pass the mocked value
              />
            )}

            <DuesSection title="Hostel Dues" status="unknown">
              <p className="text-gray-500">Hostel dues information is not available at the moment.</p>
            </DuesSection>
            
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center mt-8">
              {requestStatus === 'idle' ? (
                <button
                  onClick={handleRequest}
                  disabled={hasPendingDues}
                  className={`text-white py-3 px-6 rounded-lg ${
                    hasPendingDues ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0b3578] hover:bg-blue-800'
                  }`}
                >
                  Request No Dues Certificate
                </button>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Request in Progress</h3>
                  <p className="text-gray-500">Waiting for departmental approvals.</p>
                </div>
              )}
               {hasPendingDues && <p className="text-red-500 text-sm mt-4">You cannot request a certificate while you have pending dues.</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}