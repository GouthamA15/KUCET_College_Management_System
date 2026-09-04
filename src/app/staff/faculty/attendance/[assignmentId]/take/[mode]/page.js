'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { FacultyAttendanceProvider } from '@/context/FacultyAttendanceContext';
import AttendanceSheet from '@/components/staff/faculty/AttendanceSheet';
import MobileAttendanceSheet from '@/components/staff/faculty/MobileAttendanceSheet';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TakeAttendancePage() {
  const router = useRouter();
  const { assignmentId, mode } = useParams();
  
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mode is valid
    const validModes = ['manual', 'qr', 'gps'];
    if (mode && !validModes.includes(mode)) {
      router.replace(`/staff/faculty/attendance/${assignmentId}`);
      return;
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const fetchAssignment = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/staff/faculty/assignments?id=${encodeURIComponent(assignmentId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch assignment');
        const match = (data.data || []).find(a => String(a.id) === String(assignmentId));
        setAssignment(match || null);
      } catch (e) {
        toast.error(e.message || 'Error loading assignment');
      } finally {
        setLoading(false);
      }
    };
    
    if (assignmentId) {
      fetchAssignment();
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, [assignmentId, mode, router]);

  const handleBack = () => {
    router.push('/staff/faculty/academics');
  };

  const handleRetry = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/staff/faculty/assignments?id=${encodeURIComponent(assignmentId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      const match = (data.data || []).find(a => String(a.id) === String(assignmentId));
      setAssignment(match || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="inline-block h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading attendance register...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-7xl mx-auto w-full text-center py-12 px-4">
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-4 font-bold text-xl">!</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Assignment Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">
            Unable to load the requested subject assignment. Please check your network connection or permissions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
            <Link href={`/staff/faculty/attendance/${assignmentId}`} className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 inline-flex items-center justify-center">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Taking Attendance — {mode === 'qr' ? 'Zero Trust QR' : mode === 'gps' ? 'GPS & PIN' : 'Manual Entry'}</h1>
        <p className="text-gray-500">{assignment.subject_name} ({assignment.subject_code})</p>
      </div>
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <FacultyAttendanceProvider assignment={assignment}>
          {isMobile ? (
            <MobileAttendanceSheet onBack={handleBack} mode={mode} />
          ) : (
            <AttendanceSheet onBack={handleBack} mode={mode} />
          )}
        </FacultyAttendanceProvider>
      </Suspense>
    </div>
  );
}
