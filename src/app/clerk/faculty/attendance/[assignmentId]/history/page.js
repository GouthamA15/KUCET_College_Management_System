'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AttendanceHistoryViewer from '@/components/clerk/faculty/AttendanceHistoryViewer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const { assignmentId } = useParams();
  
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const res = await fetch('/api/clerk/faculty/assignments');
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
  }, [assignmentId]);

  const handleBack = () => {
    router.push(`/clerk/faculty/attendance/${assignmentId}`);
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!assignment) {
    return (
      <div className="max-w-7xl mx-auto w-full text-center py-10">
        <h2 className="text-xl font-semibold mb-4">Assignment Not Found</h2>
        <Link href={`/clerk/faculty/attendance/${assignmentId}`} className="text-blue-500 hover:underline inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Mode Selection
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Attendance History</h1>
        <p className="text-gray-500">{assignment.subject_name} ({assignment.subject_code})</p>
      </div>
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <AttendanceHistoryViewer assignment={assignment} onBack={handleBack} />
      </Suspense>
    </div>
  );
}
