'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import { useClerk } from '@/context/ClerkContext';
import AssignedSubjectsList from '@/components/clerk/faculty/AssignedSubjectsList';
import SubjectInterestForm from '@/components/clerk/faculty/SubjectInterestForm';
import InterestStatusList from '@/components/clerk/faculty/InterestStatusList';
import ClassList from '@/components/clerk/faculty/ClassList';
import HODConsole from '@/components/clerk/faculty/HODConsole';

export default function FacultyDashboardOverview() {
  const router = useRouter();
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [assignments, setAssignments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeSection, setActiveSection] = useState(null); // 'subjects' | 'timetable' | 'classList'

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'faculty') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  const fetchAssignments = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/clerk/faculty/assignments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch assignments');
      setAssignments(data.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSelectAssignment = (assignment, type) => {
    if (type === 'attendance') {
      router.push(`/clerk/faculty/attendance?id=${assignment.id}`);
    } else if (type === 'marks') {
      router.push(`/clerk/faculty/marks?id=${assignment.id}`);
    }
  };

  const activeCount = assignments.filter(a => a.is_active).length;
  const inactiveCount = assignments.filter(a => !a.is_active).length;
  const totalAssigned = assignments.length;

  const Card = ({ onClick, icon, title, description }) => (
    <div
      onClick={onClick}
      className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm flex items-center gap-4 transition-shadow duration-200 ease-in-out cursor-pointer hover:shadow-md"
    >
      <div className="w-11 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex flex-col justify-center">
        <div className="font-semibold text-gray-900" style={{ fontSize: '17px' }}>{title}</div>
        <div className="text-sm text-gray-500  leading-relaxed">{description}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-6 mt-6 pb-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Faculty Dashboard</h1>
        
        {clerk?.is_hod && !activeSection && (
          <div className="mb-10">
            <HODConsole />
          </div>
        )}

        {/* If no active section, show the cards grid immediately (no header/hero) */}
        {!activeSection && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              icon="📘"
              title="My Subjects"
              description={loadingData ? 'Loading...' : (totalAssigned > 0 ? `You are assigned to ${totalAssigned} subjects (${activeCount} active).` : 'You are not assigned any subjects.')}
              onClick={() => setActiveSection('subjects')}
            />
            <Card
              icon="📅"
              title="My Timetable"
              description="Timetable module is coming soon."
              onClick={() => setActiveSection('timetable')}
            />
            <Card
              icon="👨‍🎓"
              title="Class List"
              description="Browse students by branch and semester."
              onClick={() => setActiveSection('classList')}
            />
          </section>
        )}

        {/* Active Section Rendering */}
        {activeSection && (
          <div className="space-y-4">
            <button onClick={() => setActiveSection(null)} className="text-[#0b3578] hover:underline font-medium">&larr; Back to Home</button>
            {activeSection === 'subjects' && (
              <>
                <AssignedSubjectsList 
                  onSelectAssignment={handleSelectAssignment} 
                  showActions={true} 
                />
                <SubjectInterestForm onInterestSubmitted={fetchAssignments} />
                <InterestStatusList />
              </>
            )}
            {activeSection === 'timetable' && (
              <div className="bg-white border rounded p-6 text-gray-600">Timetable module is under development and will be available soon.</div>
            )}
            {activeSection === 'classList' && (
              <ClassList />
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}