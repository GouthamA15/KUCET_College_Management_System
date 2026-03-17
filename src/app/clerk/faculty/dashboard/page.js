'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AssignedSubjectsList from '@/components/clerk/faculty/AssignedSubjectsList';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';
import MarksEntrySheet from '@/components/clerk/faculty/MarksEntrySheet';
import SubjectInterestForm from '@/components/clerk/faculty/SubjectInterestForm';
import InterestStatusList from '@/components/clerk/faculty/InterestStatusList';
import ClassList from '@/components/clerk/faculty/ClassList';
import HODConsole from '@/components/clerk/faculty/HODConsole';
import PersonalSchedule from '@/components/clerk/faculty/PersonalSchedule';
import FacultyActivityBar from '@/components/clerk/faculty/FacultyActivityBar';
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
    return <div className="min-h-[60vh] flex items-center justify-center font-bold text-gray-400">LOADING FACULTY CONSOLE...</div>;
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
    <>
      <FacultyActivityBar />
      <div className="max-w-7xl mx-auto w-full mt-4 pb-12 px-4">
        <div className="border-b-2 border-[#0b3578] mb-6 pb-2">
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Faculty Administration Portal</h1>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Official Academic Management Console</p>
        </div>
        
        {clerk?.is_hod && !activeSection && (
          <div className="mb-8">
            <HODConsole />
          </div>
        )}

        {!activeSection && (
          <div className="mb-8">
            <PersonalSchedule />
          </div>
        )}

        {!activeSection ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveSection(card.id)}
                className="flex flex-col text-left bg-white border border-slate-200 shadow-sm hover:border-[#0b3578] transition-colors group"
              >
                <div className={`${card.color.replace('bg-', 'text-')} p-4 border-b border-slate-100 flex items-center justify-between`}>
                  <span className="text-2xl opacity-80">{card.icon}</span>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-[#0b3578]">Access Module →</div>
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-tight">{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">{card.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-md p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight uppercase">
                {activeSection === 'subjects' ? 'My Assigned Subjects' : cards.find(c => c.id === activeSection)?.title}
              </h2>
              <button
                onClick={handleBackToDashboard}
                className="text-[10px] font-bold text-[#0b3578] hover:underline flex items-center gap-2 uppercase tracking-widest border border-[#0b3578]/20 px-3 py-1.5 bg-blue-50/50 w-fit"
              >
                &larr; Return to Dashboard
              </button>
            </div>

            <div className="overflow-x-auto">
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
                <div className="space-y-10">
                  <SubjectInterestForm onInterestSubmitted={handleInterestSubmitted} />
                  <InterestStatusList />
                </div>
              )}
              
              {activeSection === 'classList' && (
                <ClassList />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
