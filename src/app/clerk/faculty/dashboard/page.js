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
import LoadingSpinner from '@/components/ui/LoadingSpinner';

import { useClerk } from '@/context/ClerkContext';
import { FacultyAttendanceProvider } from '@/context/FacultyAttendanceContext';

export default function FacultyDashboardOverview() {
  const router = useRouter();
  const { clerkData: clerk, loading } = useClerk();

  const [activeSection, setActiveSection] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [activeHodTab, setActiveHodTab] = useState(null);

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
    setActiveSection(mode === 'attendance' ? 'attendance' : 'marks');
  };

  const handleOpenWorkstream = (id) => {
    setSelectedAssignment(null);
    setActiveSection(id);
  };

  const handleBackToDashboard = () => {
    setActiveSection(null);
    setSelectedAssignment(null);
  };

  if (loading) {
    return <LoadingSpinner label="Loading Faculty Dashboard" />;
  }

  const firstName = clerk?.name?.split(' ')[0] || 'Faculty';
  const employeeLabel = clerk?.employee_id || (clerk?.role ? String(clerk.role).toUpperCase() : 'FACULTY');
  const roleLabel = clerk?.is_hod ? 'HOD Office' : 'Faculty';

  const modules = [
    {
      id: 'subjects',
      title: 'My Subjects',
      description: 'Attendance and internal marks for your assigned subjects.',
      icon: '📚',
      tone: 'bg-indigo-50 text-indigo-700',
      accent: 'border-t-indigo-400',
    },
    {
      id: 'interests',
      title: 'Subject Interests',
      description: 'Express and track your teaching preferences for upcoming terms.',
      icon: '💡',
      tone: 'bg-amber-50 text-amber-700',
      accent: 'border-t-amber-400',
    },
    {
      id: 'classList',
      title: 'Class Lists',
      description: 'Review rosters for your assigned classes.',
      icon: '👥',
      tone: 'bg-emerald-50 text-emerald-700',
      accent: 'border-t-emerald-400',
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

      <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
        <header className="border-b border-slate-100 pb-4" />

        {!activeSection ? (
          <>
            <div className="mt-3 space-y-3">
              <h1 className="text-center text-3xl font-black tracking-tight text-slate-800 uppercase">Welcome, {firstName}</h1>
              <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
                <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                  {employeeLabel}
                </span>
                <span className="text-slate-200">|</span>
                <span className="text-xs font-medium uppercase tracking-tight">{roleLabel}</span>
              </div>
            </div>

            {clerk?.is_hod ? (
              <HODConsole
                workstreams={modules}
                onSelectWorkstream={handleOpenWorkstream}
                onActiveSubTabChange={setActiveHodTab}
              />
            ) : null}

            {!clerk?.is_hod ? (
              <section className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Workstreams</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select an operational module</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {modules.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleOpenWorkstream(mod.id)}
                      className={`text-left bg-white p-6 rounded-sm border border-slate-200 border-t-4 ${mod.accent} shadow-sm hover:shadow-md transition-all group relative overflow-hidden h-44 flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between relative z-10">
                        <div
                          className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl ${mod.tone} shadow-sm border border-black/5`}
                        >
                          {mod.icon}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Module</span>
                      </div>

                      <div className="mt-4 space-y-1 relative z-10">
                        <h3 className="text-base font-black text-slate-800 tracking-tight uppercase group-hover:text-[#0b3578] transition-colors">
                          {mod.title}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80">
                          {mod.description}
                        </p>
                      </div>

                      <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                        <span className="text-[10px] font-black text-[#0b3578] uppercase tracking-widest flex items-center gap-1">
                          Launch <span className="text-sm">→</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {clerk?.is_hod && (activeHodTab === 'analytics' || activeHodTab === 'config' || activeHodTab === 'allocation') ? null : (
              <PersonalSchedule />
            )}
          </>
        ) : (
          <section className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase">{activeMeta.title}</h2>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-1">{activeMeta.description}</p>
              </div>
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="text-[10px] font-black text-[#0b3578] hover:text-blue-900 flex items-center gap-2 uppercase tracking-widest border border-slate-200 px-3 py-2 bg-white rounded-sm w-fit"
              >
                ← Return to Dashboard
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-x-auto">
              {activeSection === 'subjects' && !selectedAssignment ? (
                <AssignedSubjectsList onSelectAssignment={handleSelectAssignment} />
              ) : null}

              {activeSection === 'attendance' && selectedAssignment ? (
                <FacultyAttendanceProvider assignment={selectedAssignment}>
                  <AttendanceSheet
                    onBack={() => {
                      setSelectedAssignment(null);
                      setActiveSection('subjects');
                    }}
                  />
                </FacultyAttendanceProvider>
              ) : null}

              {activeSection === 'marks' && selectedAssignment ? (
                <MarksEntrySheet
                  assignment={selectedAssignment}
                  onBack={() => {
                    setSelectedAssignment(null);
                    setActiveSection('subjects');
                  }}
                />
              ) : null}

              {activeSection === 'interests' ? (
                <div className="space-y-8">
                  <SubjectInterestForm onInterestSubmitted={handleInterestSubmitted} />
                  <InterestStatusList />
                </div>
              ) : null}

              {activeSection === 'classList' ? <ClassList /> : null}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
