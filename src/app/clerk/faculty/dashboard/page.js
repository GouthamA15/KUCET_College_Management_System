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
      kicker: 'Teaching',
      accentBg: 'bg-indigo-50',
      titleClass: 'text-indigo-900',
      badgeClass: 'text-indigo-600 bg-indigo-50',
      linkClass: 'text-indigo-600 group-hover:text-indigo-700',
    },
    {
      id: 'interests',
      title: 'Subject Interests',
      description: 'Express interest in teaching subjects for upcoming semesters.',
      icon: '💡',
      kicker: 'Planning',
      accentBg: 'bg-amber-50',
      titleClass: 'text-amber-900',
      badgeClass: 'text-amber-700 bg-amber-50',
      linkClass: 'text-amber-600 group-hover:text-amber-700',
    },
    {
      id: 'classList',
      title: 'Class Lists',
      description: 'View and export student lists for your classes.',
      icon: '👥',
      kicker: 'Roster',
      accentBg: 'bg-emerald-50',
      titleClass: 'text-emerald-900',
      badgeClass: 'text-emerald-700 bg-emerald-50',
      linkClass: 'text-emerald-600 group-hover:text-emerald-700',
    },
  ];

  const sectionMeta = {
    subjects: {
      title: 'My Assigned Subjects',
      description: 'Select a subject to manage attendance or internal marks.',
    },
    attendance: {
      title: 'Attendance Sheet',
      description: 'Record and review attendance for the selected subject.',
    },
    marks: {
      title: 'Internal Assessment',
      description: 'Enter or update mid and assignment marks for the selected subject.',
    },
    interests: {
      title: 'Subject Interests',
      description: 'Track and submit your teaching preferences for upcoming terms.',
    },
    classList: {
      title: 'Class Lists',
      description: 'Download and review rosters for your assigned classes.',
    },
  };

  const activeMeta = sectionMeta[activeSection] || sectionMeta.subjects;

  return (
    <>
      <FacultyActivityBar />
      <div className="max-w-7xl mx-auto w-full mt-6 pb-12 px-4">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Faculty Administration Portal</h1>
          <p className="text-gray-600">Manage attendance, marks, and class operations from a single console.</p>
        </div>
        
        {clerk?.is_hod && !activeSection && (
          <div className="mb-8 bg-white border-2 border-indigo-50 rounded-2xl p-4 md:p-6 shadow-sm">
            <HODConsole />
          </div>
        )}

        {!activeSection && (
          <div className="mb-8 bg-white border-2 border-indigo-50 rounded-2xl p-4 md:p-6 shadow-sm">
            <PersonalSchedule />
          </div>
        )}

        {!activeSection ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveSection(card.id)}
                className="border-2 rounded-2xl p-5 transition-all duration-300 relative group overflow-hidden text-left bg-white border-indigo-50 hover:shadow-xl hover:border-indigo-200"
              >
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ${card.accentBg}`}></div>
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xl">{card.icon}</span>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${card.badgeClass}`}>Module</span>
                  </div>
                  <div className={`font-black text-xl leading-tight mt-3 mb-1 ${card.titleClass}`}>{card.title}</div>
                  <div className="text-xs font-mono font-bold mb-2 uppercase tracking-widest text-gray-400">{card.kicker}</div>
                  <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
                  <div className={`mt-4 text-[10px] font-bold uppercase tracking-widest ${card.linkClass}`}>Open Module →</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white border-2 border-indigo-50 rounded-2xl p-4 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 border-b border-gray-200 pb-4 gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">{activeMeta.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{activeMeta.description}</p>
              </div>
              <button
                onClick={handleBackToDashboard}
                className="text-[10px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-2 uppercase tracking-widest border border-indigo-200 px-3 py-1.5 bg-indigo-50/60 rounded-full w-fit"
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
