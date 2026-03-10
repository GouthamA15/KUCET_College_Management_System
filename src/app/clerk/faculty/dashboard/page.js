'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import AssignedSubjectsList from '@/components/clerk/faculty/AssignedSubjectsList';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';
import MarksEntrySheet from '@/components/clerk/faculty/MarksEntrySheet';
import SubjectInterestForm from '@/components/clerk/faculty/SubjectInterestForm';
import InterestStatusList from '@/components/clerk/faculty/InterestStatusList';
import ClassList from '@/components/clerk/faculty/ClassList';
import HODConsole from '@/components/clerk/faculty/HODConsole';
import PersonalSchedule from '@/components/clerk/faculty/PersonalSchedule';
import { useClerk } from '@/context/ClerkContext';
import { FacultyAttendanceProvider } from '@/context/FacultyAttendanceContext';

export default function FacultyDashboardOverview() {
  const router = useRouter();
  const { clerkData: clerk, loading } = useClerk();
  const [activeSection, setActiveSection] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentMode, setAssignmentMode] = useState(null); // 'attendance' | 'marks'

  useEffect(() => {
    if (!loading && !clerk) {
      router.push('/');
    }
  }, [clerk, loading, router]);

  const handleInterestSubmitted = useCallback(() => {
    // Optional: refresh logic
  }, []);

  const handleSelectAssignment = (asgn, mode) => {
    setSelectedAssignment(asgn);
    setAssignmentMode(mode);
    setActiveSection(mode === 'attendance' ? 'attendance' : 'marks');
  };

  const handleBackToDashboard = () => {
    setActiveSection(null);
    setSelectedAssignment(null);
    setAssignmentMode(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">LOADING FACULTY CONSOLE...</div>;
  }

  const cards = [
    {
      id: 'subjects',
      title: 'My Subjects',
      description: 'Mark attendance and internal marks for your assigned courses.',
      icon: '📚',
      color: 'bg-blue-600',
    },
    {
      id: 'interests',
      title: 'Subject Interests',
      description: 'Express interest in teaching subjects for upcoming semesters.',
      icon: '💡',
      color: 'bg-purple-600',
    },
    {
      id: 'classList',
      title: 'Class Lists',
      description: 'View and export student lists for your classes.',
      icon: '👥',
      color: 'bg-teal-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-6 mt-6 pb-12">
        <h1 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-tight">Faculty Dashboard</h1>
        
        {clerk?.is_hod && !activeSection && (
          <div className="mb-10">
            <HODConsole />
          </div>
        )}

        {!activeSection && (
          <div className="mb-10">
            <PersonalSchedule />
          </div>
        )}

        {!activeSection ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveSection(card.id)}
                className="flex flex-col text-left bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className={`${card.color} p-5 flex items-center justify-between`}>
                  <span className="text-3xl">{card.icon}</span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-black text-gray-900 mb-1 uppercase tracking-tight">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed font-medium">{card.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                {activeSection === 'subjects' ? 'My Assigned Subjects' : cards.find(c => c.id === activeSection)?.title}
              </h2>
              <button
                onClick={handleBackToDashboard}
                className="text-xs font-black text-blue-600 hover:text-blue-800 flex items-center gap-2 uppercase tracking-widest"
              >
                &larr; Return to Dashboard
              </button>
            </div>

            {activeSection === 'subjects' && !selectedAssignment && (
              <AssignedSubjectsList onSelectAssignment={handleSelectAssignment} />
            )}

            {activeSection === 'attendance' && selectedAssignment && (
              <FacultyAttendanceProvider assignment={selectedAssignment}>
                <AttendanceSheet onBack={() => { setSelectedAssignment(null); setActiveSection('subjects'); }} />
              </FacultyAttendanceProvider>
            )}

            {activeSection === 'marks' && selectedAssignment && (
              <MarksEntrySheet 
                assignment={selectedAssignment} 
                onBack={() => { setSelectedAssignment(null); setActiveSection('subjects'); }} 
              />
            )}

            {activeSection === 'interests' && (
              <div className="space-y-12">
                <SubjectInterestForm onInterestSubmitted={handleInterestSubmitted} />
                <InterestStatusList />
              </div>
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
