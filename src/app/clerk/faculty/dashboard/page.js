'use client';
import { useState, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import toast from 'react-hot-toast';
import SubjectInterestForm from '@/components/clerk/faculty/SubjectInterestForm';
import AssignedSubjectsList from '@/components/clerk/faculty/AssignedSubjectsList';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';
import MarksEntrySheet from '@/components/clerk/faculty/MarksEntrySheet';
import InterestStatusList from '@/components/clerk/faculty/InterestStatusList';

export default function FacultyDashboard() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments', 'interest', 'status'
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [viewMode, setViewMode] = useState(null); // 'attendance', 'marks'

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'faculty') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading faculty dashboard...</p>
      </div>
    );
  }

  const handleSelectAssignment = (assignment, mode) => {
    setSelectedAssignment(assignment);
    setViewMode(mode);
  };

  const handleBack = () => {
    setSelectedAssignment(null);
    setViewMode(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      {clerk && <Navbar clerkMode={true} />}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">Faculty Dashboard</h1>
          {!selectedAssignment && (
            <div className="flex bg-white rounded-lg shadow p-1">
              <button
                onClick={() => setActiveTab('assignments')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'assignments' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
              >
                My Assignments
              </button>
              <button
                onClick={() => setActiveTab('interest')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'interest' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Apply for Subject
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'status' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Interest Status
              </button>
            </div>
          )}
        </div>

        {clerk ? (
          <div className="space-y-6">
            {!selectedAssignment ? (
              <>
                {activeTab === 'assignments' && (
                  <AssignedSubjectsList onSelectAssignment={handleSelectAssignment} />
                )}
                {activeTab === 'interest' && (
                  <SubjectInterestForm onInterestSubmitted={() => {}} />
                )}
                {activeTab === 'status' && (
                  <InterestStatusList />
                )}
              </>
            ) : (
              <>
                {viewMode === 'attendance' ? (
                  <AttendanceSheet assignment={selectedAssignment} onBack={handleBack} />
                ) : (
                  <MarksEntrySheet assignment={selectedAssignment} onBack={handleBack} />
                )}
              </>
            )}
          </div>
        ) : (
          <p>Unable to load clerk data.</p>
        )}
      </main>
      <Footer />
    </div>
  );
}
