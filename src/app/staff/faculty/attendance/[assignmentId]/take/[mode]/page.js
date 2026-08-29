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
        const res = await fetch('/api/staff/faculty/assignments');
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
    
    if (assignmentId) {
      fetchAssignment();
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, [assignmentId, mode, router]);

  const handleBack = () => {
    router.push('/staff/faculty/academics');
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!assignment) {
    return (
      <div className="max-w-7xl mx-auto w-full text-center py-10">
        <h2 className="text-xl font-semibold mb-4">Assignment Not Found</h2>
        <Link href={`/staff/faculty/attendance/${assignmentId}`} className="text-blue-500 hover:underline inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Mode Selection
        </Link>
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
