'use client';

import { useState, useEffect, useCallback } from 'react';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import PersonalSchedule from '@/components/staff/faculty/PersonalSchedule';
import { useStaff } from '@/context/StaffContext';

export default function FacultyTimetableOverview() {
  const router = useRouter();
  const { staffData } = useStaff();
  
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const [instances, setInstances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Create Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [newProgram, setNewProgram] = useState('');
  const [newSemester, setNewSemester] = useState(1);
  const [newAcademicYear, setNewAcademicYear] = useState('');

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

  const openCreateModal = () => {
    if (staffData?.branches?.length > 0 && !newProgram) {
      setNewProgram(staffData.branches[0]);
    }
    setShowCreate(true);
  };

  const fetchInstances = useCallback(async () => {
    if (!staffData?.is_hod) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/staff/hod/timetable-instances');
      if (res.ok) {
        const json = await res.json();
        setInstances(json.data || []);
        if (json.systemYear) setNewAcademicYear(json.systemYear);
      }
    } catch (_e) {
      toast.error('Failed to fetch timetables');
    } finally {
      setIsLoading(false);
    }
  }, [staffData?.is_hod]);

  useEffect(() => {
    if (staffData?.is_hod) {
      const timer = setTimeout(() => fetchInstances(), 0);
      return () => clearTimeout(timer);
    }
  }, [staffData?.is_hod, fetchInstances]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch('/api/staff/hod/timetable-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: newProgram,
          semester: newSemester,
          academic_year: newAcademicYear
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Timetable created');
        setShowCreate(false);
        router.push(`/staff/faculty/time-table/${data.id}`);
      } else {
        toast.error(data.error || 'Failed to create');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsCreating(false);
    }
  };

  const bottomSheet = typeof document !== 'undefined' && isBottomSheetOpen ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
        >
          <X size={20} />
        </button>
        <h3 className="text-lg font-bold text-[#0b2447] mb-3">About Timetables</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Periods:</strong> 7 class periods per day, Monday through Saturday.</li>
            <li><strong>Short Break:</strong> 11:10–11:20 AM between Period 2 and Period 3.</li>
            <li><strong>Lunch Break:</strong> 01:00–02:00 PM between Period 4 and Period 5.</li>
            {staffData?.is_hod && <li>HODs can create and publish timetables for their department.</li>}
          </ul>
        </div>
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  if (!staffData) return null;

  if (!staffData.is_hod) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
        {bottomSheet}
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800">Teaching Schedule</h1>
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
              onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); if (isMobileDevice) setIsBottomSheetOpen(true); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              >
                <Info size={20} className="shrink-0" />
              </button>
              {isHovered && !isMobileDevice && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                  <h4 className="text-sm font-bold text-[#0b2447] mb-2">About Teaching Schedule</h4>
                  <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                    <li><strong>Periods:</strong> 7 class periods per day.</li>
                    <li>Only periods officially assigned to you are shown.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Your weekly assigned teaching periods and class locations.</p>
        </header>
        <PersonalSchedule />
      </div>
    );
  }

  // HOD View
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
      {bottomSheet}
      <header className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800">Timetable</h1>
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
              onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); if (isMobileDevice) setIsBottomSheetOpen(true); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <Info size={20} className="shrink-0" />
              </button>
              {isHovered && !isMobileDevice && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                  <h4 className="text-sm font-bold text-[#0b2447] mb-2">About Timetables</h4>
                  <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                    <li><strong>Periods:</strong> 7 class periods per day.</li>
                    <li>HODs can create and publish timetables for their department.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Manage department schedules and publish class timetables.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-[#0b3578] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-900 transition-colors shrink-0 cursor-pointer"
        >
          + Create Timetable
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent animate-spin rounded-full"></div>
        </div>
      ) : instances.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-md p-10 text-center">
          <p className="text-slate-500 font-medium">There are no timetables published. Create a new one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map(inst => {
            const year = Math.ceil(inst.semester / 2);
            let circleColor = 'bg-slate-50/80 group-hover:bg-slate-100';
            let hoverBorder = 'hover:border-slate-300';
            
            if (inst.status === 'PUBLISHED') {
              circleColor = 'bg-emerald-50/80 group-hover:bg-emerald-100';
              hoverBorder = 'hover:border-emerald-200';
            } else if (inst.status === 'DRAFT') {
              circleColor = 'bg-amber-50/80 group-hover:bg-amber-100';
              hoverBorder = 'hover:border-amber-200';
            }

            return (
              <div 
                key={inst.id} 
                onClick={() => router.push(`/staff/faculty/time-table/${inst.id}`)} 
                className={`bg-white rounded-md p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all cursor-pointer ${hoverBorder}`}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 ${circleColor} rounded-bl-full -mr-5 -mt-5 transition-all duration-300 group-hover:scale-110`}></div>
                <div className="relative flex flex-col items-center text-center">
                  <h3 className="font-bold text-slate-800 text-lg tracking-wide mb-1">{inst.branch}</h3>
                  <p className="text-xs font-medium text-slate-500 mb-4">
                    Year {year} &bull; Semester {inst.semester} <br />
                    <span className="opacity-80 font-normal">Academic Year {inst.academic_year}</span>
                  </p>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    inst.status === 'PUBLISHED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                    inst.status === 'DRAFT' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {inst.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg text-slate-800">Create New Timetable</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Program</label>
                <select value={newProgram} onChange={e => setNewProgram(e.target.value)} className="w-full border border-slate-200 p-2 rounded focus:outline-none focus:border-[#0b3578]">
                  {staffData?.branches?.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Semester</label>
                <select value={newSemester} onChange={e => setNewSemester(parseInt(e.target.value))} className="w-full border border-slate-200 p-2 rounded focus:outline-none focus:border-[#0b3578]">
                  {[1,2,3,4,5,6,7,8].map(y => <option key={y} value={y}>Semester {y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Academic Year</label>
                <input type="text" value={newAcademicYear} readOnly className="w-full border border-slate-200 p-2 rounded bg-slate-50 focus:outline-none text-slate-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded hover:bg-slate-50 font-medium text-sm">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 bg-[#0b3578] text-white py-2 rounded hover:bg-blue-900 font-medium text-sm disabled:opacity-50">
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}