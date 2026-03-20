'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useClerk } from '@/context/ClerkContext';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';
import MobileAttendanceSheet from '@/components/clerk/faculty/MobileAttendanceSheet';
import { FacultyAttendanceProvider } from '@/context/FacultyAttendanceContext';

function AttendanceContent() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('id');
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const res = await fetch('/api/clerk/faculty/assignments');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch assignments');
        
        const assignmentsList = data.data || [];
        // Sort assignments: Active first, History last
        const sortedAssignments = [...assignmentsList].sort((a, b) => {
          if (a.is_active === b.is_active) return 0;
          return a.is_active ? -1 : 1;
        });
        
        setAssignments(sortedAssignments);

        // Pre-select if ID is in URL
        if (assignmentId) {
          const preSelected = assignmentsList.find(a => String(a.id) === String(assignmentId));
          if (preSelected) setSelectedAssignment(preSelected);
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchAssignments();
  }, [assignmentId]);

  const resetSelection = () => {
    setSelectedAssignment(null);
  };

  const SubjectCard = ({ assignment, onSelect }) => {
    const isActive = assignment.is_active;
    
    return (
      <div
        onClick={() => onSelect(assignment)}
        className={`border-2 rounded-2xl p-5 transition-all duration-300 relative group overflow-hidden cursor-pointer ${
          isActive 
            ? 'bg-white border-indigo-50 hover:shadow-xl hover:border-indigo-200' 
            : 'bg-gray-50 border-gray-100 opacity-80 grayscale-[0.5] hover:grayscale-0 hover:opacity-100'
        }`}
      >
        <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ${
          isActive ? 'bg-indigo-50' : 'bg-gray-200'
        }`}></div>

        <div className="relative">
            <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <div className={`font-black text-xl leading-tight mb-1 break-words ${
                isActive ? 'text-indigo-900' : 'text-gray-600'
              }`}>
                {assignment.subject_name}
              </div>
              <div className={`text-xs font-mono font-bold mb-2 uppercase tracking-widest ${
                isActive ? 'text-indigo-500' : 'text-gray-400'
              }`}>
                {assignment.subject_code}
              </div>
            </div>
            <div className="ml-3 flex-shrink-0">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-200'
              }`}>
                {isActive ? 'Active' : 'History'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="bg-white/50 p-2 rounded-xl border border-gray-100">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Branch</div>
              <div className="text-xs font-bold text-gray-700 truncate">{assignment.branch}</div>
            </div>
            <div className="bg-white/50 p-2 rounded-xl border border-gray-100">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Semester</div>
              <div className="text-xs font-bold text-gray-700"> {assignment.semester}</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-bold uppercase mt-2">Academic Year</div>
          <div className="text-xs font-bold text-gray-700">{assignment.academic_year}</div>
        </div>
      </div>
    );
  };

  const activeAssignments = assignments.filter(a => a.is_active);
  const historyAssignments = assignments.filter(a => !a.is_active);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Attendance</h1>
        <p className="text-gray-600">
          {selectedAssignment ? `Managing attendance for ${selectedAssignment.subject_name}` : 'Select a subject to manage attendance.'}
        </p>
      </div>

      {!selectedAssignment ? (
        loadingAssignments ? (
          <div className="text-center py-6">Loading assignments...</div>
        ) : assignments.length > 0 ? (
          <div className="space-y-12">
            {/* Active Subjects */}
            {activeAssignments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAssignments.map(assignment => (
                  <SubjectCard key={assignment.id} assignment={assignment} onSelect={setSelectedAssignment} />
                ))}
              </div>
            )}

            {/* Inactive/History Subjects */}
            {historyAssignments.length > 0 && (
              <section className="pt-8 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-6 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-lg font-bold uppercase tracking-wider">Subject History</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {historyAssignments.map(assignment => (
                    <SubjectCard key={assignment.id} assignment={assignment} onSelect={setSelectedAssignment} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-10 bg-white border rounded-lg">
            <h3 className="text-lg font-medium text-gray-800">No Subjects Assigned</h3>
            <p className="text-gray-500 mt-2">You are not assigned to any subjects for attendance management.</p>
          </div>
        )
      ) : (
        <FacultyAttendanceProvider assignment={selectedAssignment}>
          <div className="hidden md:block">
            <AttendanceSheet onBack={resetSelection} />
          </div>
          <div className="block md:hidden">
            <MobileAttendanceSheet onBack={resetSelection} />
          </div>
        </FacultyAttendanceProvider>
      )}
    </>
  );
}

export default function FacultyAttendancePage() {
  return (
    <div className="max-w-7xl mx-auto w-full">
      <Suspense fallback={<div className="text-center py-10">Loading Attendance Portal...</div>}>
        <AttendanceContent />
      </Suspense>
    </div>
  );
}
