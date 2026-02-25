'use client';
import React from 'react';

export default function ProfileTabs({ activeTab, setActiveTab, personalPanel, scholarshipPanel, syllabusPanel, academicPanel }) {
  return (
    <div className="mt-6 border rounded-lg">
      <div className="flex border-b bg-gray-50 rounded-t-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'personal' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Personal Tab
        </button>
        <button
          onClick={() => setActiveTab('academic')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'academic' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Attendance / Mid Marks
        </button>
        <button
          onClick={() => setActiveTab('scholarship')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'scholarship' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Scholarship Details
        </button>
        <button
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'syllabus' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Syllabus
        </button>
      </div>

      <div className="p-4 min-h-70">
        {activeTab === 'personal' && personalPanel}
        {activeTab === 'academic' && academicPanel}
        {activeTab === 'scholarship' && scholarshipPanel}
        {activeTab === 'syllabus' && syllabusPanel}
      </div>
    </div>
  );
}
