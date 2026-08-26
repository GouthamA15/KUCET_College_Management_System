'use client';

import React, { useState, useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import HodFacultyInterests from '@/components/staff/faculty/HodFacultyInterests';
import SubjectAssignmentsList from '@/components/staff/faculty/SubjectAssignmentsList';
import ActiveFacultyList from '@/components/staff/faculty/ActiveFacultyList';

export default function HodStaffManagementClient() {
  const { loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty } = useStaff();
  const [activeTab, setActiveTab] = useState('interests');

  // Load faculty assignments if needed to populate staff context, though not strictly required for these specific API calls.
  useEffect(() => {
    if (!loading && staffData?.is_hod && !hasFetchedFaculty && !isLoadingFaculty && refreshFaculty) {
      refreshFaculty();
    }
  }, [loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty]);

  // Verify HOD status
  if (!loading && staffData && !staffData.is_hod) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <p className="text-red-500 font-medium">Unauthorized Access. You must be an HOD to view this page.</p>
      </div>
    );
  }

  if (loading || !staffData) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        <p className="text-sm text-gray-600 mt-1">Manage department faculty, subject requests, and assignments.</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-3">
        <button 
          onClick={() => setActiveTab('interests')} 
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'interests' ? 'bg-[#0b3578] text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
        >
          Faculty Interests
        </button>
        <button 
          onClick={() => setActiveTab('active-faculty')} 
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'active-faculty' ? 'bg-[#0b3578] text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
        >
          Active Faculty
        </button>
        <button 
          onClick={() => setActiveTab('assignments')} 
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'assignments' ? 'bg-[#0b3578] text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
        >
          Subject Assignments
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm min-h-[50vh]">
        {activeTab === 'interests' && <HodFacultyInterests />}
        {activeTab === 'active-faculty' && <ActiveFacultyList />}
        {activeTab === 'assignments' && <SubjectAssignmentsList />}
      </div>
    </div>
  );
}
