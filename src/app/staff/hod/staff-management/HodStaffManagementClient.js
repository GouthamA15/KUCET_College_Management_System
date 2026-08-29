'use client';

import React, { useState, useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import HodFacultyInterests from '@/components/staff/faculty/HodFacultyInterests';
import ActiveFacultyList from '@/components/staff/faculty/ActiveFacultyList';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function HodStaffManagementClient() {
  const { loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty } = useStaff();
  const tabs = [
    { id: 'interests', label: 'Faculty Interests' },
    { id: 'faculty', label: 'Active Faculty' },
  ];

  const [activeTab, setActiveTab] = useState('interests');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

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

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-sheet-title"
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Staff Management Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            Manage department faculty, subject requests, and assignments.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Faculty Interests:</strong> Review and approve/reject subject requests submitted by your department faculty.</li>
            <li><strong>Active Faculty:</strong> View the roster of all faculty members currently assigned to your department.</li>
          </ul>
        </div>
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
      
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Staff Management</h1>
          
          <div
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) setIsBottomSheetOpen(true);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Staff Management Information</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Manage department faculty, subject requests, and assignments.
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Faculty Interests:</strong> Review and approve/reject subject requests submitted by your department faculty.</li>
                  <li><strong>Active Faculty:</strong> View the roster of all faculty members currently assigned to your department.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Manage department faculty, subject requests, and assignments.</p>
        
        {/* Mobile tabs */}
        <div className="md:hidden flex flex-wrap items-center gap-2 mt-3.5 pb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === t.id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Desktop tabs */}
      <div className="hidden md:flex items-center gap-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === t.id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm min-h-[50vh]">
        {activeTab === 'interests' && <HodFacultyInterests />}
        {activeTab === 'faculty' && <ActiveFacultyList />}
      </div>
    </div>
  );
}
