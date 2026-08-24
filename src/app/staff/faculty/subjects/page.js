'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import SubjectInterestForm from '@/components/staff/faculty/SubjectInterestForm';
import InterestStatusList from '@/components/staff/faculty/InterestStatusList';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

function SubjectsContent() {
  const router = useRouter();
  const { staffData, loading, facultyAssignments } = useStaff();
  const [activeTab, setActiveTab] = useState('subjects');

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

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm text-center text-slate-500">
        Loading Subjects Module...
      </div>
    );
  }

  const assignmentsList = facultyAssignments || [];
  const activeAssignments = assignmentsList.filter(a => a.is_active);
  const historicalAssignments = assignmentsList.filter(a => !a.is_active);

  const handleSelectAssignment = (assignment, mode) => {
    if (mode === 'attendance') {
      router.push(`/staff/faculty/attendance/${assignment.id}`);
    } else if (mode === 'marks') {
      router.push(`/staff/faculty/marks?id=${assignment.id}`);
    }
  };

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
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Subjects Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            This module provides a comprehensive overview of your assigned subjects and teaching requests.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>My Subjects:</strong> Displays your current and past subject assignments, and provides direct links to manage attendance and marks.</li>
            <li><strong>Subject Requests:</strong> Allows you to submit teaching preferences for upcoming terms. Requests are routed to the department HOD for approval.</li>
          </ul>
        </div>
        <button 
          onClick={() => setIsBottomSheetOpen(false)} 
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Assigned Subjects and Requests</h1>
          
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) {
                  setIsBottomSheetOpen(true);
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Subjects Information</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This module provides a comprehensive overview of your assigned subjects and teaching requests.
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>My Subjects:</strong> Displays your current and past subject assignments, and provides direct links to manage attendance and marks.</li>
                  <li><strong>Subject Requests:</strong> Allows you to submit teaching preferences for upcoming terms. Requests are routed to the department HOD for approval.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Manage your active instructional assignments and track subject requests.</p>
      </header>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setActiveTab('subjects')} className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === 'subjects' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>My Subjects</button>
        <button onClick={() => setActiveTab('requests')} className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === 'requests' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>Subject Requests</button>
      </div>

      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <section className="border border-gray-300 rounded-md bg-white p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Active Assignments</h2>
              <p className="text-sm text-gray-600">Subjects you are currently assigned to teach.</p>
            </div>

            {activeAssignments.length > 0 ? (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-0 table-auto">
                    <thead className="bg-gray-100 text-sm font-medium text-gray-700">
                      <tr>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Code</th>
                        <th className="text-left py-2.5 px-2 whitespace-normal">Subject Name</th>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Branch</th>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Semester</th>
                        <th className="text-right py-2.5 px-2 whitespace-nowrap w-48">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAssignments.map((asgn) => (
                        <tr key={asgn.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-2 text-sm text-gray-800 whitespace-nowrap">{asgn.subject_code}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-normal">{asgn.subject_name}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-nowrap">{asgn.branch}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-nowrap">Sem {asgn.semester}</td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleSelectAssignment(asgn, 'attendance')} className="px-3 py-1 bg-white border border-gray-300 text-[#0b3578] font-medium rounded hover:bg-gray-50 text-xs transition-colors shadow-sm">
                                Attendance
                              </button>
                              <button onClick={() => handleSelectAssignment(asgn, 'marks')} className="px-3 py-1 bg-white border border-gray-300 text-[#0b3578] font-medium rounded hover:bg-gray-50 text-xs transition-colors shadow-sm">
                                Marks
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden flex flex-col gap-3">
                  {activeAssignments.map((asgn) => (
                    <div key={asgn.id} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-800 text-xs">{asgn.subject_code}</div>
                        <div className="bg-white border text-xs px-2 py-0.5 rounded text-gray-600">Active</div>
                      </div>
                      <div className="font-medium text-gray-800 mb-2">{asgn.subject_name}</div>
                      <div className="flex justify-between items-center text-xs text-gray-600 mb-3">
                        <div><span className="font-semibold">Branch:</span> {asgn.branch}</div>
                        <div><span className="font-semibold">Sem:</span> {asgn.semester}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSelectAssignment(asgn, 'attendance')} className="py-1.5 bg-white border border-gray-300 text-[#0b3578] font-medium rounded hover:bg-gray-50 text-xs transition-colors text-center shadow-sm">
                          Attendance
                        </button>
                        <button onClick={() => handleSelectAssignment(asgn, 'marks')} className="py-1.5 bg-white border border-gray-300 text-[#0b3578] font-medium rounded hover:bg-gray-50 text-xs transition-colors text-center shadow-sm">
                          Marks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-gray-50 p-6 border border-dashed border-gray-300 text-center rounded-md">
                <p className="text-gray-500 font-medium text-sm">No active instructional assignments found</p>
              </div>
            )}
          </section>

          {historicalAssignments.length > 0 && (
            <section className="border border-gray-300 rounded-md bg-white p-4 opacity-80 hover:opacity-100 transition-opacity">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Archived Assignments</h2>
                <p className="text-sm text-gray-600">Past subject assignments.</p>
              </div>
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-0 table-auto">
                    <thead className="bg-gray-100 text-sm font-medium text-gray-700">
                      <tr>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Code</th>
                        <th className="text-left py-2.5 px-2 whitespace-normal">Subject Name</th>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Branch</th>
                        <th className="text-left py-2.5 px-2 whitespace-nowrap">Session</th>
                        <th className="text-right py-2.5 px-2 whitespace-nowrap w-48">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalAssignments.map((asgn) => (
                        <tr key={asgn.id} className="border-b">
                          <td className="py-2.5 px-2 text-sm text-gray-800 whitespace-nowrap">{asgn.subject_code}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-normal">{asgn.subject_name}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-nowrap">{asgn.branch}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-700 whitespace-nowrap">{asgn.academic_year}</td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleSelectAssignment(asgn, 'attendance')} className="px-3 py-1 text-gray-500 hover:text-[#0b3578] font-medium text-xs transition-colors">
                                Attendance
                              </button>
                              <button onClick={() => handleSelectAssignment(asgn, 'marks')} className="px-3 py-1 text-gray-500 hover:text-[#0b3578] font-medium text-xs transition-colors">
                                Marks
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden flex flex-col gap-3">
                  {historicalAssignments.map((asgn) => (
                    <div key={asgn.id} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-800 text-xs">{asgn.subject_code}</div>
                        <div className="bg-white border text-xs px-2 py-0.5 rounded text-gray-400">Archived</div>
                      </div>
                      <div className="font-medium text-gray-600 mb-2">{asgn.subject_name}</div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                        <div><span className="font-semibold">Branch:</span> {asgn.branch}</div>
                        <div><span className="font-semibold">Session:</span> {asgn.academic_year}</div>
                      </div>
                      <div className="flex gap-4 border-t border-gray-200 pt-2">
                        <button onClick={() => handleSelectAssignment(asgn, 'attendance')} className="text-gray-500 hover:text-[#0b3578] font-medium text-xs transition-colors">
                          Attendance
                        </button>
                        <button onClick={() => handleSelectAssignment(asgn, 'marks')} className="text-gray-500 hover:text-[#0b3578] font-medium text-xs transition-colors">
                          Marks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            </section>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="border border-slate-200 rounded-md bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Subject Request Workflow</h2>
              <p className="text-sm text-gray-600 mt-1">Submit teaching preferences below. Requests are routed to the department HOD for approval and formal assignment.</p>
            </div>
            <SubjectInterestForm />
          </div>

          <div id="request-history-section" className="bg-white border border-gray-300 rounded-md p-4 sm:p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Request History</h2>
            <div className="border-t border-gray-100 pt-4">
              <InterestStatusList />
            </div>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}

export default function FacultySubjectsPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-6xl mx-auto space-y-6 text-sm text-center text-slate-500">Loading Subjects Module...</div>}>
      <SubjectsContent />
    </Suspense>
  );
}
