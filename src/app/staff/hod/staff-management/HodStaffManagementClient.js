'use client';

import React, { useState, useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import HodFacultyInterests from '@/components/staff/faculty/HodFacultyInterests';

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

      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-[#0b3578] mb-1">How Staff Management Works</h2>
        <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
          <li><strong>Faculty Interests:</strong> Review and approve/reject subject requests submitted by your department faculty.</li>
          <li><strong>Active Faculty:</strong> View the roster of all faculty members currently assigned to your department.</li>
        </ul>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {[
            { id: 'interests', label: 'Faculty Interests' },
            { id: 'active-faculty', label: 'Active Faculty' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-[#0b3578] text-[#0b3578]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 border border-blue-100 rounded-sm p-4 sm:p-6 shadow-sm min-h-[50vh]">
        {activeTab === 'interests' && <HodFacultyInterests />}
        {activeTab === 'active-faculty' && <ActiveFacultyList />}
      </div>
    </div>
  );
}
