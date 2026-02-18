'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import { useClerk } from '@/context/ClerkContext';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';

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

  const SubjectCard = ({ assignment, onSelect }) => {
    const statusColor = assignment.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
    return (
      <div 
        onClick={() => onSelect(assignment)}
        className="bg-white border rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-indigo-400 transition-all group"
      >
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-gray-800 group-hover:text-indigo-600">{assignment.subject_name}</h3>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor}`}>{assignment.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{assignment.subject_code}</p>
        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span className="font-medium text-gray-500">Branch:</span>
            <span className="font-bold">{assignment.branch}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-500">Semester:</span>
            <span className="font-bold">{assignment.semester}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-500">Academic Year:</span>
            <span className="font-bold">{assignment.academic_year}</span>
          </div>
        </div>
      </div>
    );
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <AttendanceSheet assignment={selectedAssignment} onBack={resetSelection} />
        )}
      </main>
      <Footer />
    </div>
  );
}