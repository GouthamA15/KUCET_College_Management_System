'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@/context/ClerkContext';
import { toast } from 'react-hot-toast';
import SyllabusManager from './SyllabusManager';
import BranchAnalytics from './BranchAnalytics';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

export default function HODConsole() {
  const { clerkData, hodBranchData, refreshHOD, isLoadingHOD } = useClerk();
  const [activeSubTab, setActiveSubTab] = useState('workload');
  const [editingSlot, setEditingSlot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef(null);
  
  // Local state for the selected subject in the modal to drive faculty highlighting
  const [modalSelectedSubject, setModalSelectedSubject] = useState('');

  // Semester State for Timetable
  const [selectedSem, setSelectedSem] = useState(6);
  const [semesterTimetable, setSemesterTimetable] = useState([]);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(false);

  // Fetch timetable for a specific semester
  const fetchSemesterTimetable = useCallback(async (sem) => {
    setIsLoadingTimetable(true);
    try {
      const res = await fetch(`/api/clerk/hod/timetable?semester=${sem}`);
      const data = await res.json();
      if (res.ok) {
        setSemesterTimetable(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch semester timetable', e);
    } finally {
      setIsLoadingTimetable(false);
    }
  }, []);

  // Update localized timetable when semester changes or global data refreshes
  useEffect(() => {
    if (activeSubTab === 'timetable') {
      fetchSemesterTimetable(selectedSem);
    }
  }, [selectedSem, activeSubTab, fetchSemesterTimetable]);

  // Handle modal open
  const openSlotEditor = (day, period, slot) => {
    setEditingSlot({ day, period, current: slot });
    setModalSelectedSubject(slot?.subject_code || '');
  };

  const branchSubjects = useMemo(() => {
    const subjects = hodBranchData?.allSubjects || [];
    const seen = new Set();
    return subjects
      .filter(s => s.semester === selectedSem)
      .filter(s => {
        if (seen.has(s.subject_code)) return false;
        seen.add(s.subject_code);
        return true;
      });
  }, [hodBranchData?.allSubjects, selectedSem]);

  const collegeFaculty = hodBranchData?.faculty || [];
  const officialAssignments = hodBranchData?.officialAssignments || [];
  
  const departmentalFaculty = useMemo(() => {
    return collegeFaculty.filter(f => f.home_branch === clerkData.branch);
  }, [collegeFaculty, clerkData.branch]);

  const handleCopyPrevious = () => {
    if (!editingSlot || editingSlot.period === 1) return;
    const prevSlot = semesterTimetable.find(
      s => s.day_of_week === editingSlot.day && s.period_number === editingSlot.period - 1
    );
    if (!prevSlot) return toast.error('No data found in the previous period to copy.');
    if (formRef.current) {
      const form = formRef.current;
      form.subject_code.value = prevSlot.subject_code || '';
      form.faculty_id.value = prevSlot.faculty_id || '';
      form.room_no.value = prevSlot.room_no || '';
      setModalSelectedSubject(prevSlot.subject_code || '');
      toast.success('Details copied from previous period');
    }
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const activeAY = clerkData?.academic_year || '2025-26';

    const payload = {
      day_of_week: editingSlot.day,
      period_number: editingSlot.period,
      subject_code: formData.get('subject_code'),
      faculty_id: formData.get('faculty_id'),
      room_no: formData.get('room_no'),
      semester: selectedSem,
      academic_year: activeAY
    };
    if (!payload.subject_code) return toast.error('Please select a subject or activity');
    setIsSaving(true);
    try {
      const res = await fetch('/api/clerk/hod/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Timetable updated for Semester ${selectedSem}`);
        setEditingSlot(null);
        fetchSemesterTimetable(selectedSem);
        refreshHOD();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editingSlot?.current) return;
    if (!confirm('Are you sure you want to delete this lecture from the timetable?')) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clerk/hod/timetable?semester=${selectedSem}&day_of_week=${editingSlot.day}&period_number=${editingSlot.period}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Lecture removed from timetable');
        setEditingSlot(null);
        fetchSemesterTimetable(selectedSem);
        refreshHOD();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Deletion failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearTimetable = async (action) => {
    const message = action === 'clearAll' 
      ? 'CRITICAL: This will permanently DELETE the timetable for EVERY semester (S1-S8) in this department. Are you absolutely sure?'
      : `Are you sure you want to clear the entire timetable for Semester ${selectedSem}?`;
    
    if (!confirm(message)) return;
    
    setIsSaving(true);
    try {
      const url = `/api/clerk/hod/timetable?action=${action}&semester=${selectedSem}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        toast.success(action === 'clearAll' ? 'Departmental timetable wiped' : `Semester ${selectedSem} timetable cleared`);
        fetchSemesterTimetable(selectedSem);
        refreshHOD();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Clear failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!clerkData?.is_hod) return null;

  return (
    <div className="bg-white border border-slate-200 shadow-sm mt-8">
      <div className="bg-[#0b3578] border-b border-white/10 px-6 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <span>Departmental Management Matrix</span>
              <span className="bg-white/10 text-blue-100 text-[9px] px-2 py-0.5 border border-white/20 uppercase tracking-[0.2em]">
                {clerkData.branch} Engineering
              </span>
            </h2>
            <p className="text-blue-200/60 text-[9px] font-medium uppercase tracking-widest mt-1">Official HOD Control Panel &bull; Registry V4.0</p>
          </div>
          <button 
            onClick={refreshHOD}
            disabled={isLoadingHOD}
            className={`p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all ${isLoadingHOD ? 'animate-spin opacity-50' : ''}`}
            title="Synchronize Departmental Data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mt-6 overflow-x-auto pb-1 no-scrollbar border-t border-white/5 pt-4">
          {[
            { id: 'workload', label: 'Faculty Load', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { id: 'timetable', label: 'Edit Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z' },
            { id: 'allocation', label: 'Assignment Registry', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
            { id: 'syllabus', label: 'Branch Syllabus', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
            { id: 'analytics', label: 'Data Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { id: 'config', label: 'Department Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
          ].map(tab => ( activeSubTab === tab.id ? (
            <button key={tab.id} className="flex items-center gap-2 px-4 py-2 bg-white text-[#0b3578] font-bold border-t-2 border-amber-400 whitespace-nowrap text-[10px] uppercase tracking-widest transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} /></svg>
              {tab.label}
            </button>
          ) : (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} className="flex items-center gap-2 px-4 py-2 text-blue-100 hover:text-white hover:bg-white/5 whitespace-nowrap text-[10px] uppercase tracking-widest font-medium transition-all">
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} /></svg>
              {tab.label}
            </button>
          )))}
        </div>
      </div>

      <div className="p-4 md:p-8 min-h-[450px]">
        {!hodBranchData ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent animate-spin"></div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Syncing Records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeSubTab === 'workload' && <WorkloadView data={departmentalFaculty} branch={clerkData.branch} />}
            {activeSubTab === 'timetable' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 border border-slate-200 gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Select Semester:</span>
                    <div className="flex flex-wrap gap-1">
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <button 
                          key={s} 
                          onClick={() => setSelectedSem(s)}
                          className={`w-8 h-8 font-bold text-[10px] transition-all border ${selectedSem === s ? 'bg-[#0b3578] text-white border-[#0b3578]' : 'bg-white text-slate-400 hover:border-[#0b3578] border-slate-200'}`}
                        >
                          S{s}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isLoadingTimetable && <div className="w-4 h-4 border-2 border-[#0b3578] border-t-transparent animate-spin"></div>}
                    <button 
                      onClick={() => handleClearTimetable('clearSemester')}
                      className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Clear Sem {selectedSem}
                    </button>
                    <button 
                      onClick={() => handleClearTimetable('clearAll')}
                      className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Wipe Departmental Timetable
                    </button>
                  </div>
                </div>

                <TimetableManager 
                  data={semesterTimetable} 
                  onEditSlot={openSlotEditor}
                />
              </div>
            )}
            {activeSubTab === 'allocation' && (
              <SubjectAllocation 
                subjects={hodBranchData.allSubjects} 
                faculty={collegeFaculty} 
                assignments={officialAssignments}
                refresh={refreshHOD}
              />
            )}
            {activeSubTab === 'syllabus' && <SyllabusManager branch={clerkData.branch} />}
            {activeSubTab === 'analytics' && <BranchAnalytics branch={clerkData.branch} />}
            {activeSubTab === 'config' && <BranchConfig config={hodBranchData?.config} branch={clerkData.branch} refresh={refreshHOD} />}
          </div>
        )}
      </div>

      {/* Slot Editor Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-md animate-in zoom-in-95 min-h-[550px] flex flex-col">
            <div className="bg-[#0b3578] p-5 text-white flex justify-between items-center border-b border-white/10">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Update Academic Schedule</h3>
                <p className="text-blue-200 text-[9px] font-medium uppercase tracking-widest mt-0.5">Sem {selectedSem} &bull; {editingSlot.day} &bull; Period {editingSlot.period}</p>
              </div>
              <button onClick={() => setEditingSlot(null)} className="p-1 hover:bg-white/10 transition-colors text-white/60 hover:text-white">&times;</button>
            </div>
            <form ref={formRef} onSubmit={handleSaveSlot} className="p-6 space-y-5 flex-1 overflow-y-auto pb-24">
              {editingSlot.period > 1 && (
                <button 
                  type="button" 
                  onClick={handleCopyPrevious}
                  className="w-full py-2 bg-blue-50 text-[#0b3578] text-[9px] font-bold uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Replicate Period {editingSlot.period - 1} Parameters
                </button>
              )}

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject / Activity Registry</label>
                <select 
                  name="subject_code" 
                  defaultValue={editingSlot.current?.subject_code || ''} 
                  onChange={(e) => setModalSelectedSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-colors"
                >
                  <optgroup label={`Core Syllabus (Sem ${selectedSem})`}>
                    {branchSubjects.map(s => (
                      <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Institutional Directives">
                    {INSTITUTIONAL_ACTIVITIES.map(a => (
                      <option key={a.code} value={a.code}>{a.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assigned Faculty Member</label>
                <select name="faculty_id" defaultValue={editingSlot.current?.faculty_id || ''} className="w-full bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-colors">
                  <option value="">No Faculty Assigned</option>
                  
                  {modalSelectedSubject && (
                    <optgroup label="Officially Authorized Personnel">
                      {collegeFaculty
                        .filter(f => officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                        .map(f => (
                          <option key={`assigned-${f.id}`} value={f.id} className="font-bold text-blue-700 bg-blue-50">
                            ⭐ {f.name} (Primary Subject Handler)
                          </option>
                        ))
                      }
                    </optgroup>
                  )}

                  <optgroup label="Institutional Registry (All Departments)">
                    {collegeFaculty
                      .filter(f => !modalSelectedSubject || !officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} {f.home_branch ? `(${f.home_branch})` : '(No Branch)'}
                        </option>
                      ))
                    }
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Classroom Allocation</label>
                <input name="room_no" type="text" placeholder="e.g. LH-113" defaultValue={editingSlot.current?.room_no || ''} className="w-full bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-colors" />
              </div>

              <div className="flex gap-2">
                {editingSlot.current && (
                  <button 
                    type="button" 
                    onClick={handleDeleteSlot}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-white text-red-600 font-bold uppercase tracking-widest text-[10px] hover:bg-red-50 transition-all disabled:opacity-50 border border-red-200"
                  >
                    Delete Lecture
                  </button>
                )}
                <button type="submit" disabled={isSaving} className={`${editingSlot.current ? 'flex-[2]' : 'w-full'} py-4 bg-[#0b3578] text-white font-bold uppercase tracking-widest text-[10px] hover:bg-blue-900 transition-all disabled:opacity-50 border border-[#0b3578]`}>
                  {isSaving ? 'Synchronizing System...' : `Deploy to Semester ${selectedSem}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkloadView({ data, branch }) {
  return (
    <div className="animate-in slide-in-from-bottom-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3 uppercase tracking-tight">
          <div className="w-8 h-8 bg-[#0b3578] flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          {branch} Faculty Operational Load
        </h3>
        <span className="text-[9px] bg-slate-50 text-slate-500 px-3 py-1 font-bold uppercase tracking-widest border border-slate-200">Real-Time Metrics Registry</span>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {data.map(f => (
          <div key={f.id} className="bg-white border border-slate-200 p-6 hover:border-[#0b3578] transition-all group">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-[#0b3578] text-xl group-hover:bg-[#0b3578] group-hover:text-white transition-all">
                  {f.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800 group-hover:text-[#0b3578] transition-colors uppercase tracking-wider">{f.name}</h4>
                  <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">{f.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                     {f.subjects ? f.subjects.split(', ').map(s => (
                       <span key={s} className="text-[8px] font-bold bg-slate-50 text-slate-500 px-2 py-0.5 border border-slate-200 uppercase tracking-tighter">{s}</span>
                     )) : <span className="text-[8px] font-medium text-slate-300 italic">No Official Authorization</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
                 <div className="bg-slate-50 border border-slate-100 p-3 text-center">
                    <div className="text-lg font-bold text-slate-800">{f.scheduled_weekly}</div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Weekly / Sch</div>
                 </div>
                 <div className="bg-slate-50 border border-slate-100 p-3 text-center">
                    <div className="text-lg font-bold text-slate-800">{f.total_conducted}</div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Sem / Reg</div>
                 </div>
                 <div className="bg-[#0b3578]/5 border border-[#0b3578]/10 p-3 text-center">
                    <div className="text-lg font-bold text-[#0b3578]">
                       {f.scheduled_weekly > 0 ? Math.min(Math.round((f.total_conducted / (f.scheduled_weekly * 4)) * 100), 100) : 0}%
                    </div>
                    <div className="text-[7px] font-bold text-[#0b3578]/60 uppercase tracking-widest">Performance</div>
                 </div>
              </div>

            </div>
            
            <div className="mt-6 relative pt-2">
              <div className="w-full bg-slate-50 h-2 overflow-hidden border border-slate-100">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${f.scheduled_weekly > 15 ? 'bg-red-500' : 'bg-[#0b3578]'}`}
                  style={{ width: `${Math.min((f.scheduled_weekly / 20) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2 px-0.5">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Instructional Intensity Index</span>
                <span className={`text-[8px] font-bold uppercase tracking-widest ${f.scheduled_weekly > 15 ? 'text-red-600' : 'text-[#0b3578]'}`}>
                  {f.scheduled_weekly > 15 ? 'Overload Warning' : f.scheduled_weekly > 10 ? 'Standard Load' : 'Base Load'}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {data.length === 0 && (
          <div className="text-center py-20 bg-slate-50 border border-slate-200">
            <div className="text-3xl mb-4 opacity-30">👨‍🏫</div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No Registered Faculty Personnel Found</p>
            <p className="text-[9px] text-slate-400 max-w-xs mx-auto mt-2 font-medium leading-relaxed">Ensure all department members are correctly registered in the University Personnel Registry.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TimetableManager({ data, onEditSlot }) {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periods = [1, 2, 3, 4, 5, 6, 7];
  
  const getSlot = (day, period) => data.find(s => s.day_of_week === day && s.period_number === period);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-4 flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-slate-800 tracking-wider uppercase">Active Master Matrix</h3>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold uppercase tracking-widest">
          System Registry Active
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200">
        <table className="w-full border-collapse text-xs min-w-[1000px]">
          <thead>
            <tr>
              <th className="border-b border-r border-slate-200 bg-slate-50 p-4 text-slate-400 font-bold uppercase tracking-widest w-24">Day</th>
              {periods.map(p => (
                <th key={p} className="border-b border-slate-200 bg-slate-50 p-4">
                  <div className="font-bold text-slate-700 uppercase tracking-widest mb-1 text-[10px]">Period {p}</div>
                  <div className="text-[8px] font-bold text-[#0b3578]/60 uppercase tracking-tighter">
                    {p === 1 && '09:30 - 10:20'}
                    {p === 2 && '10:20 - 11:10'}
                    {p === 3 && '11:20 - 12:10'}
                    {p === 4 && '12:10 - 01:00'}
                    {p === 5 && '02:00 - 02:50'}
                    {p === 6 && '02:50 - 03:40'}
                    {p === 7 && '03:40 - 04:30'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day} className="hover:bg-slate-50 transition-colors">
                <td className="border-r border-b border-slate-200 bg-slate-50/50 font-bold text-center p-4 text-slate-600 text-[10px] uppercase">
                  {day}
                </td>
                {periods.map(p => {
                  const slot = getSlot(day, p);
                  const isActivity = slot && INSTITUTIONAL_ACTIVITIES.some(a => a.code === slot.subject_code);
                  return (
                    <td 
                      key={`${day}-${p}`} 
                      onClick={() => onEditSlot(day, p, slot)}
                      className={`border-b border-slate-100 p-3 text-center transition-all cursor-pointer relative hover:bg-white hover:z-10 hover:shadow-xl group/cell ${slot ? (isActivity ? 'bg-amber-50/10' : 'bg-white') : 'bg-slate-50/5'}`}
                    >
                      {slot ? (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                          <div className={`font-bold text-[10px] mb-1 line-clamp-2 uppercase tracking-tight leading-tight ${isActivity ? 'text-amber-700' : 'text-[#0b3578]'}`}>
                            {isActivity ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code)?.name : (slot.subject_name || slot.subject_code)}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold mb-2 line-clamp-1 opacity-80">{slot.faculty_name || (isActivity ? 'N/A' : 'NOT ASSIGNED')}</div>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[8px] bg-slate-50 text-slate-500 px-2 py-0.5 border border-slate-200 font-bold uppercase tracking-widest">
                              {slot.room_no || 'TBD'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 opacity-10 group-hover/cell:opacity-100 transition-all py-2">
                          <div className="text-[#0b3578] font-bold uppercase tracking-widest text-[7px]">Available</div>
                          <div className="w-6 h-6 border border-dashed border-[#0b3578] flex items-center justify-center text-[#0b3578] group-hover/cell:bg-[#0b3578] group-hover/cell:text-white">+</div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-8 flex flex-wrap gap-8 items-center justify-center bg-slate-50 p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-200 flex items-center justify-center text-orange-500 font-bold text-sm">☕</div>
          <div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Instructional Break</div>
            <div className="text-[10px] font-bold text-slate-700 uppercase">11:10 AM - 11:20 AM</div>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-200 flex items-center justify-center text-emerald-500 font-bold text-sm">🍱</div>
          <div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Luncheon Break</div>
            <div className="text-[10px] font-bold text-slate-700 uppercase">01:00 PM - 02:00 PM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectAllocation({ subjects, faculty, assignments, refresh }) {
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedFac, setSelectedFac] = useState('');
  const [selectedSem, setSelectedSem] = useState(6);
  const [isSaving, setIsSaving] = useState(false);

  const filteredAssignments = assignments.filter(a => a.course_semester === selectedSem);

  const handleAuthorize = async () => {
    if (!selectedSub || !selectedFac) return toast.error('Please select both subject and faculty');
    const subjectObj = subjects.find(s => s.subject_code === selectedSub);
    setIsSaving(true);
    try {
      const res = await fetch('/api/clerk/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faculty_id: selectedFac,
          subject_code: selectedSub,
          subject_name: subjectObj?.subject_name,
          semester: selectedSem
        })
      });
      if (res.ok) {
        toast.success('Authorization complete');
        refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this faculty authorization?')) return;
    try {
      const res = await fetch(`/api/clerk/hod/subject-assignments?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Authorization revoked');
        refresh();
      }
    } catch (e) { toast.error('Failed'); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-500">
      <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Faculty Authorization Registry</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Authorization Form */}
        <div className="bg-slate-50 border border-slate-200 p-6 h-fit sticky top-6">
          <h4 className="font-bold text-slate-700 mb-6 uppercase tracking-widest text-[9px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#0b3578] rounded-full"></span>
            New Personnel Authorization
          </h4>
          <div className="space-y-5">
             <div>
               <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block px-0.5 tracking-widest">Academic Semester</label>
               <select 
                 value={selectedSem}
                 onChange={(e) => setSelectedSem(parseInt(e.target.value))}
                 className="w-full bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-all"
               >
                 {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
               </select>
             </div>
             <div>
               <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block px-0.5 tracking-widest">Target Subject Registry</label>
               <select 
                 value={selectedSub}
                 onChange={(e) => setSelectedSub(e.target.value)}
                 className="w-full bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-all"
               >
                 <option value="">Select Subject</option>
                 {subjects.filter(s => s.semester === selectedSem).map(s => (
                   <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                 ))}
               </select>
             </div>
             <div>
               <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block px-0.5 tracking-widest">Registered Personnel</label>
               <select 
                 value={selectedFac}
                 onChange={(e) => setSelectedFac(e.target.value)}
                 className="w-full bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0b3578] transition-all"
               >
                 <option value="">Select Faculty Member</option>
                 {faculty.map(f => (
                   <option key={f.id} value={f.id}>{f.name} {f.home_branch ? `(${f.home_branch})` : ''}</option>
                 ))}
               </select>
             </div>
             <button 
               onClick={handleAuthorize}
               disabled={isSaving}
               className="w-full py-4 bg-[#0b3578] text-white font-bold uppercase tracking-widest text-[9px] hover:bg-blue-900 transition-all border border-[#0b3578] disabled:opacity-50 mt-4 shadow-sm"
             >
               {isSaving ? 'Synchronizing Authorization...' : 'Authorize Personnel Access'}
             </button>
          </div>
        </div>

        {/* Existing Assignments List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex justify-between items-center px-1">
              <h4 className="font-bold text-slate-800 uppercase tracking-tight text-xs">Active Registry (Semester {selectedSem})</h4>
              <span className="text-[8px] font-bold text-[#0b3578] bg-blue-50 px-3 py-1 border border-blue-100 uppercase tracking-widest">{filteredAssignments.length} Official Records</span>
           </div>

           <div className="grid grid-cols-1 gap-3">
              {filteredAssignments.map(a => (
                <div key={a.id} className="bg-white border border-slate-200 p-5 flex justify-between items-center group hover:border-[#0b3578] transition-all shadow-sm">
                   <div className="flex items-center gap-5">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-100 flex items-center justify-center text-sm group-hover:bg-blue-50 transition-colors">🎓</div>
                      <div>
                         <h5 className="font-bold text-slate-800 tracking-wider text-[11px] leading-tight mb-1 uppercase">{a.subject_name}</h5>
                         <div className="flex items-center gap-3">
                            <span className="text-[8px] font-bold text-[#0b3578] border border-[#0b3578]/20 bg-blue-50 px-2 py-0.5 uppercase tracking-widest">{a.subject_code}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Handler: <span className="text-slate-600 underline underline-offset-2 decoration-slate-300">{a.faculty_name}</span></span>
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => handleRevoke(a.id)}
                     className="p-2.5 text-slate-300 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-600 transition-all opacity-0 group-hover:opacity-100"
                     title="Revoke Registry Authorization"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>
              ))}

              {filteredAssignments.length === 0 && (
                <div className="bg-slate-50 border border-dashed border-slate-300 py-20 flex flex-col items-center justify-center text-center px-10">
                   <div className="text-3xl mb-4 opacity-20">🔐</div>
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">No Faculty Authorized for Semester {selectedSem} Registry</p>
                   <p className="text-[8px] text-slate-400 mt-2 max-w-xs uppercase tracking-tighter opacity-60">Authorized personnel will be granted system access to manage student academic records for this semester.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function BranchConfig({ config, branch, refresh }) {
  const [isUpdating, setIsSaving] = useState(false);

  const updatePattern = async (mid, ass) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/clerk/hod/branch-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch,
          mid_max: mid,
          assignment_max: ass,
          academic_year: '2025-26',
          semester: 6
        })
      });
      if (res.ok) {
        toast.success('Pattern updated');
        refresh();
      }
    } catch (e) {
      toast.error('Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <h3 className="text-sm font-bold text-slate-800 mb-8 uppercase tracking-wider px-1">Institutional Departmental Directives</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-1">
        <div className="bg-white border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center text-xl">📊</div>
            <div>
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Internal Assessment Schema</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Mandatory pattern for departmental theory subjects</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { mid: 20, ass: 10, label: 'University Standard (20+10)' },
              { mid: 25, ass: 5, label: 'Institutional Advanced (25+5)' }
            ].map(p => (
              <button 
                key={p.mid}
                onClick={() => updatePattern(p.mid, p.ass)}
                disabled={isUpdating}
                className={`w-full p-4 flex justify-between items-center transition-all border ${config?.mid_max === p.mid ? 'border-[#0b3578] bg-blue-50/20' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-left">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">{p.label}</div>
                  <div className="text-[8px] font-bold text-[#0b3578] uppercase tracking-widest mt-1">MID: {p.mid} | ASSIGNMENT: {p.ass}</div>
                </div>
                {config?.mid_max === p.mid && <div className="w-5 h-5 bg-[#0b3578] flex items-center justify-center text-white text-[8px] font-bold">ACTIVE</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-[#0b3578] p-8 text-white border border-[#0b3578]">
              <h4 className="font-bold text-[10px] mb-2 uppercase tracking-[0.3em] text-blue-300 opacity-80">University Affiliate Branch</h4>
              <div className="text-3xl font-bold mb-1 tracking-tight">{branch}</div>
              <div className="text-[9px] font-bold text-blue-200/60 uppercase tracking-widest mb-8 border-b border-white/10 pb-4">Engineering Department Control Unit</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 border border-white/10">
                  <div className="text-[8px] font-bold text-blue-300 uppercase mb-1 tracking-widest opacity-70">Academic Period</div>
                  <div className="font-bold text-xs">2025-2026</div>
                </div>
                <div className="bg-white/5 p-4 border border-white/10">
                  <div className="text-[8px] font-bold text-blue-300 uppercase mb-1 tracking-widest opacity-70">Active Session</div>
                  <div className="font-bold text-xs uppercase">VI (Even Semester)</div>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
