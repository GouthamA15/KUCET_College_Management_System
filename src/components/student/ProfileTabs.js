'use client';
import React from 'react';

export default function ProfileTabs({ activeTab, setActiveTab, personalPanel, scholarshipPanel, syllabusPanel }) {
  return (
    <div className="mt-6 border rounded-lg">
      <div className="flex border-b bg-gray-50 rounded-t-lg">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'personal' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Personal Tab
        </button>
        <button
          onClick={() => setActiveTab('scholarship')}
          className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'scholarship' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Scholarship Details
        </button>
        <button
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'syllabus' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
        >
          Syllabus
        </button>
      </div>

      <div className="p-4 min-h-70">
        {activeTab === 'personal' && personalPanel}
        {activeTab === 'scholarship' && scholarshipPanel}
        {activeTab === 'syllabus' && syllabusPanel}
      </div>
    </div>
  );
}
