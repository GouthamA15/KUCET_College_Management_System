'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { getStatusStyles } from '@/lib/ui-utils';

export default function InterestStatusList() {
  const { facultyInterests = [], isLoadingFaculty } = useStaff();
  
  const loading = isLoadingFaculty;
  const interests = facultyInterests;

  const formatIstDate = (value) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      try {
        return new Date(value).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <svg className="animate-spin h-6 w-6 text-indigo-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <div className="text-sm text-gray-600">Loading requests...</div>
      </div>
    );
  }

  if (interests.length === 0) {
    return <div className="flex items-center justify-center h-32 text-gray-600">No subject requests found.</div>;
  }

  return (
    <div className="w-full">
      {/* Desktop Table */}
      <div className="hidden md:block max-h-130 overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-gray-200 text-left text-[13px] font-semibold text-gray-700 uppercase tracking-[0.6px] border-b-2 border-gray-300">
              <th className="px-3 py-2 w-2/5">Subject</th>
              <th className="px-3 py-2 w-1/5">Branch / Sem</th>
              <th className="px-3 py-2 w-1/5">Academic Year</th>
              <th className="px-3 py-2 w-1/5 text-center">Status</th>
              <th className="px-3 py-2 w-1/5 text-right">Applied On</th>
            </tr>
          </thead>
          <tbody>
            {interests.map((interest) => {
              const s = (interest.status || '').toUpperCase();
              return (
                <tr key={interest.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-3 py-2 text-sm text-gray-800 align-middle">
                    <div className="font-semibold">{interest.subject_name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{interest.subject_code}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 align-middle">
                    {interest.branch} | Sem {interest.semester}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 align-middle">
                    {interest.academic_year}
                  </td>
                  <td className="px-3 py-2 text-sm text-center align-middle">
                    <span className={`inline-flex items-center justify-center ${getStatusStyles(s)} text-sm font-medium rounded-sm px-2 py-1`}>
                      {s}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 text-right align-middle">
                    {formatIstDate(interest.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {interests.map((interest) => {
          const s = (interest.status || '').toUpperCase();
          return (
            <div key={interest.id} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono font-bold text-gray-500">{interest.subject_code}</span>
                  <span className="text-sm font-bold text-gray-800">{interest.subject_name}</span>
                </div>
                <span className={`inline-flex items-center justify-center ${getStatusStyles(s)} text-xs font-medium rounded-sm px-2 py-1`}>
                  {s}
                </span>
              </div>
              <div className="text-xs text-gray-600 mb-2 font-medium">
                {interest.branch} | Semester {interest.semester} | {interest.academic_year}
              </div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1 border-t border-gray-100 pt-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Applied: {formatIstDate(interest.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
