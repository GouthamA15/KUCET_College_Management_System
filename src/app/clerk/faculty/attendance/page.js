'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import { useClerk } from '@/context/ClerkContext';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';
import MobileAttendanceSheet from '@/components/clerk/faculty/MobileAttendanceSheet';
import { FacultyAttendanceProvider } from '@/context/FacultyAttendanceContext';

export default function FacultyAttendancePage() {
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
        setAssignments(data.data || []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchAssignments();
  }, []);

  const resetSelection = () => {
    setSelectedAssignment(null);
  };

  const SubjectCard = ({ assignment, onSelect }) => (
    <div
      onClick={() => onSelect(assignment)}
      className="bg-white border-2 border-indigo-50 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 relative group overflow-hidden cursor-pointer"
    >
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>

      <div className="relative">
          <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-black text-xl leading-tight mb-1 text-indigo-900 break-words">
              {assignment.subject_name}
            </div>
            <div className="text-xs font-mono font-bold mb-2 text-indigo-500 uppercase tracking-widest">
              {assignment.subject_code}
            </div>
          </div>
          <div className="ml-3 flex-shrink-0">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              {assignment.is_active ? 'Active' : 'History'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Branch</div>
            <div className="text-xs font-bold text-gray-700 truncate">{assignment.branch}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Semester</div>
            <div className="text-xs font-bold text-gray-700"> {assignment.semester}</div>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 font-bold uppercase mt-2">Academic Year</div>
        <div className="text-xs font-bold text-gray-700">{assignment.academic_year}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map(assignment => (
                <SubjectCard key={assignment.id} assignment={assignment} onSelect={setSelectedAssignment} />
              ))}
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
      </main>
      <Footer />
    </div>
  );
}