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

  if (!clerkData?.is_hod) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden mt-8">
      <div className="bg-gradient-to-r from-[#0b3578] to-blue-800 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>HOD Management Console</span>
              <span className="bg-blue-400/20 text-blue-100 text-xs px-2 py-1 rounded uppercase tracking-widest">
                Branch: {clerkData.branch}
              </span>
            </h2>
            <p className="text-blue-100/80 text-sm mt-1 tracking-tight">Departmental control center for {clerkData.branch} Engineering</p>
          </div>
          <button 
            onClick={refreshHOD}
            disabled={isLoadingHOD}
            className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all ${isLoadingHOD ? 'animate-spin opacity-50' : ''}`}
            title="Refresh Branch Data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex gap-4 mt-6 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'workload', label: 'Faculty Load', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { id: 'timetable', label: 'Edit Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'allocation', label: 'Subject Assignment', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
            { id: 'syllabus', label: 'Branch Syllabus', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
            { id: 'analytics', label: 'Branch Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { id: 'config', label: 'Branch Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
          ].map(tab => ( activeSubTab === tab.id ? (
            <button key={tab.id} className="flex items-center gap-2 px-4 py-2 bg-white text-blue-800 rounded-lg font-bold shadow-md transition-all whitespace-nowrap text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} /></svg>
              {tab.label}
            </button>
          ) : (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all whitespace-nowrap text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} /></svg>
              {tab.label}
            </button>
          )))}
        </div>
      </div>

      <div className="p-6 min-h-[450px]">
        {!hodBranchData ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Syncing departmental data...</p>
          </div>
        ) : (
          <>
            {activeSubTab === 'workload' && <WorkloadView data={departmentalFaculty} branch={clerkData.branch} />}
            {activeSubTab === 'timetable' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Select Semester:</span>
                    <div className="flex gap-1.5">
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <button 
                          key={s} 
                          onClick={() => setSelectedSem(s)}
                          className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${selectedSem === s ? 'bg-[#0b3578] text-white shadow-lg scale-110' : 'bg-white text-gray-400 hover:text-blue-600 border border-gray-100'}`}
                        >
                          S{s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isLoadingTimetable && <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
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
          </>
        )}
      </div>

      {/* Slot Editor Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 min-h-[600px] flex flex-col">
            <div className="bg-[#0b3578] p-6 text-white flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-black text-lg">Update Schedule</h3>
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Semester {selectedSem} &bull; {editingSlot.day} &bull; Period {editingSlot.period}</p>
              </div>
              <button onClick={() => setEditingSlot(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">&times;</button>
            </div>
            <form ref={formRef} onSubmit={handleSaveSlot} className="p-8 space-y-5 flex-1 overflow-y-auto pb-32">
              {editingSlot.period > 1 && (
                <button 
                  type="button" 
                  onClick={handleCopyPrevious}
                  className="w-full py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Duplicate Period {editingSlot.period - 1} details
                </button>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Target Subject / Activity</label>
                <select 
                  name="subject_code" 
                  defaultValue={editingSlot.current?.subject_code || ''} 
                  onChange={(e) => setModalSelectedSubject(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500"
                >
                  <optgroup label={`Core Syllabus Subjects (Sem ${selectedSem})`}>
                    {branchSubjects.map(s => (
                      <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Institutional Activities">
                    {INSTITUTIONAL_ACTIVITIES.map(a => (
                      <option key={a.code} value={a.code}>{a.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Handling Faculty</label>
                <select name="faculty_id" defaultValue={editingSlot.current?.faculty_id || ''} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500">
                  <option value="">No Faculty Assigned</option>
                  
                  {modalSelectedSubject && (
                    <optgroup label="Officially Assigned Teachers">
                      {collegeFaculty
                        .filter(f => officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                        .map(f => (
                          <option key={`assigned-${f.id}`} value={f.id} className="font-bold text-blue-700 bg-blue-50">
                            ⭐ {f.name} (Assigned to this Subject)
                          </option>
                        ))
                      }
                    </optgroup>
                  )}

                  <optgroup label="All Working Faculty">
                    {collegeFaculty.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.home_branch ? `(${f.home_branch})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Assigned Room</label>
                <input name="room_no" type="text" placeholder="e.g. LH-113" defaultValue={editingSlot.current?.room_no || ''} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500" />
              </div>
              <button type="submit" disabled={isSaving} className="w-full py-5 bg-[#0b3578] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:bg-blue-900 transition-all disabled:opacity-50">
                {isSaving ? 'Synchronizing...' : `Deploy to Semester ${selectedSem}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkloadView({ data, branch }) {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8 px-2">
        <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          {branch} Faculty Activity Pulse
        </h3>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-blue-100">Live Department Metrics</span>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {data.map(f => (
          <div key={f.id} className="bg-white border-2 border-gray-50 rounded-[2rem] p-8 hover:border-blue-200 transition-all group shadow-sm hover:shadow-xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                  {f.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-xl text-gray-800 group-hover:text-blue-800 transition-colors uppercase tracking-tight">{f.name}</h4>
                  <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">{f.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                     {f.subjects ? f.subjects.split(', ').map(s => (
                       <span key={s} className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg uppercase tracking-tighter border border-gray-200/50">{s}</span>
                     )) : <span className="text-[9px] font-bold text-gray-300 italic">No official assignments</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 w-full lg:w-auto">
                 <div className="bg-gray-50 rounded-2xl p-4 flex-1 lg:w-32 text-center border border-gray-100 group-hover:bg-blue-50 transition-colors">
                    <div className="text-2xl font-black text-gray-800">{f.scheduled_weekly}</div>
                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Scheduled / Wk</div>
                 </div>
                 <div className="bg-gray-50 rounded-2xl p-4 flex-1 lg:w-32 text-center border border-gray-100 group-hover:bg-indigo-50 transition-colors">
                    <div className="text-2xl font-black text-indigo-600">{f.total_conducted}</div>
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Conducted Sem</div>
                 </div>
                 <div className="bg-[#0b3578] rounded-2xl p-4 flex-1 lg:w-32 text-center shadow-lg shadow-blue-100 group-hover:bg-blue-800 transition-colors">
                    <div className="text-2xl font-black text-white">
                       {f.scheduled_weekly > 0 ? Math.min(Math.round((f.total_conducted / (f.scheduled_weekly * 4)) * 100), 100) : 0}%
                    </div>
                    <div className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Efficiency</div>
                 </div>
              </div>

            </div>
            
            <div className="mt-8 relative pt-4">
              <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden shadow-inner p-0.5 border border-gray-100">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${f.scheduled_weekly > 15 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-600 to-indigo-500'}`}
                  style={{ width: `${Math.min((f.scheduled_weekly / 20) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Weekly Load Intensity</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${f.scheduled_weekly > 15 ? 'text-red-500' : 'text-blue-600'}`}>
                  {f.scheduled_weekly > 15 ? 'Critical (Overload)' : f.scheduled_weekly > 10 ? 'Standard' : 'Light'}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {data.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4">👨‍🏫</div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-2">No faculty pulse detected</p>
            <p className="text-[10px] text-gray-400 max-w-xs mx-auto font-medium leading-relaxed">Ensure faculty members are correctly associated with "{branch}" in the Administrative Control Panel.</p>
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
      <div className="mb-6 flex justify-between items-center px-2">
        <h3 className="text-xl font-black text-gray-800 tracking-tight">Active Matrix</h3>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
          Operational Registry
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-xl shadow-blue-900/5">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-r border-gray-100 bg-gray-50/80 p-5 text-gray-400 font-black uppercase tracking-widest min-w-[80px]">Day</th>
              {periods.map(p => (
                <th key={p} className="border-b border-gray-100 bg-gray-50/80 p-5 min-w-[150px]">
                  <div className="font-black text-gray-800 uppercase tracking-widest mb-1">Period {p}</div>
                  <div className="text-[9px] font-black text-blue-600/60 bg-blue-100/30 rounded-lg py-1 inline-block px-3 border border-blue-100/50">
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
              <tr key={day} className="group">
                <td className="border-r border-b border-gray-100 bg-gray-50/30 font-black text-center p-5 text-gray-700 text-sm group-hover:bg-blue-50 transition-colors">
                  {day}
                </td>
                {periods.map(p => {
                  const slot = getSlot(day, p);
                  const isActivity = slot && INSTITUTIONAL_ACTIVITIES.some(a => a.code === slot.subject_code);
                  return (
                    <td 
                      key={`${day}-${p}`} 
                      onClick={() => onEditSlot(day, p, slot)}
                      className={`border-b border-gray-50 p-4 text-center transition-all cursor-pointer relative hover:bg-white hover:z-10 hover:shadow-2xl hover:scale-105 group/cell ${slot ? (isActivity ? 'bg-amber-50/30' : 'bg-white') : 'bg-gray-50/20'}`}
                    >
                      {slot ? (
                        <div className="animate-in zoom-in-95 duration-300">
                          <div className={`font-black text-[11px] mb-1 line-clamp-2 uppercase tracking-tight leading-tight ${isActivity ? 'text-amber-700' : 'text-blue-800'}`}>
                            {isActivity ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code)?.name : (slot.subject_name || slot.subject_code)}
                          </div>
                          <div className="text-[10px] text-gray-500 font-bold mb-2 line-clamp-1">{slot.faculty_name || (isActivity ? 'N/A' : 'Unassigned')}</div>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter border border-gray-200">
                              {slot.room_no || 'N/A'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 opacity-10 group-hover/cell:opacity-100 transition-all">
                          <div className="text-gray-400 font-black uppercase tracking-widest text-[8px]">Available Slot</div>
                          <div className="w-8 h-8 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300 group-hover/cell:border-blue-400 group-hover/cell:text-blue-500 group-hover/cell:bg-blue-50">+</div>
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
      
      <div className="mt-10 flex flex-wrap gap-10 items-center justify-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white shadow-lg shadow-orange-100 border border-orange-50 rounded-2xl flex items-center justify-center text-orange-500 font-bold text-xl">☕</div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Short Break</div>
            <div className="text-[12px] font-black text-gray-800">11:10 AM - 11:20 AM</div>
          </div>
        </div>
        <div className="w-px h-10 bg-gray-200 hidden sm:block opacity-50"></div>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white shadow-lg shadow-green-100 border border-green-50 rounded-2xl flex items-center justify-center text-green-500 font-bold text-xl">🍱</div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Lunch Break</div>
            <div className="text-[12px] font-black text-gray-800">01:00 PM - 02:00 PM</div>
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
    <div className="animate-in slide-in-from-right-4 duration-500">
      <h3 className="text-xl font-black text-gray-800 mb-6">Subject Assignment Ledger</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Authorization Form */}
        <div className="bg-white border-2 border-blue-50 rounded-3xl p-8 shadow-sm h-fit sticky top-6">
          <h4 className="font-black text-gray-700 mb-6 uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            New Faculty Authorization
          </h4>
          <div className="space-y-5">
             <div>
               <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block px-1">Active Semester</label>
               <select 
                 value={selectedSem}
                 onChange={(e) => setSelectedSem(parseInt(e.target.value))}
                 className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500 transition-all"
               >
                 {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
               </select>
             </div>
             <div>
               <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block px-1">Target Subject</label>
               <select 
                 value={selectedSub}
                 onChange={(e) => setSelectedSub(e.target.value)}
                 className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500 transition-all"
               >
                 <option value="">Select Subject</option>
                 {subjects.filter(s => s.semester === selectedSem).map(s => (
                   <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                 ))}
               </select>
             </div>
             <div>
               <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block px-1">Authorized Faculty</label>
               <select 
                 value={selectedFac}
                 onChange={(e) => setSelectedFac(e.target.value)}
                 className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500 transition-all"
               >
                 <option value="">Select Faculty</option>
                 {faculty.map(f => (
                   <option key={f.id} value={f.id}>{f.name} {f.home_branch ? `(${f.home_branch})` : ''}</option>
                 ))}
               </select>
             </div>
             <button 
               onClick={handleAuthorize}
               disabled={isSaving}
               className="w-full py-5 bg-[#0b3578] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-900 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 mt-4"
             >
               {isSaving ? 'Authorizing...' : 'Authorize Access'}
             </button>
          </div>
        </div>

        {/* Existing Assignments List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex justify-between items-center px-2">
              <h4 className="font-black text-gray-800 uppercase tracking-tight text-sm">Active Authorizations (Sem {selectedSem})</h4>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{filteredAssignments.length} Records</span>
           </div>

           <div className="grid grid-cols-1 gap-4">
              {filteredAssignments.map(a => (
                <div key={a.id} className="bg-white border border-gray-100 rounded-3xl p-6 flex justify-between items-center group hover:border-blue-200 transition-all shadow-sm">
                   <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:bg-blue-50 transition-colors">🎓</div>
                      <div>
                         <h5 className="font-black text-gray-800 tracking-tight leading-tight mb-1">{a.subject_name}</h5>
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">{a.subject_code}</span>
                            <span className="text-[10px] font-bold text-gray-400">Assigned to: <span className="text-gray-600 uppercase">{a.faculty_name}</span></span>
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => handleRevoke(a.id)}
                     className="p-3 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                     title="Revoke Authorization"
                   >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>
              ))}

              {filteredAssignments.length === 0 && (
                <div className="bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-3xl py-20 flex flex-col items-center justify-center text-center px-10">
                   <div className="text-4xl mb-4">🔐</div>
                   <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">No faculty authorized for Semester {selectedSem} yet.</p>
                   <p className="text-[9px] text-gray-300 mt-2 max-w-xs">Authorized faculty will be able to mark attendance and internal marks for their respective subjects.</p>
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
    <div className="animate-in zoom-in-95 duration-500">
      <h3 className="text-xl font-black text-gray-800 mb-8">Departmental Configuration</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border-2 border-blue-50 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">📊</div>
            <div>
              <h4 className="font-black text-gray-800">Internal Marks Pattern</h4>
              <p className="text-xs text-gray-400 font-medium">Standard pattern for branch theory subjects</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { mid: 20, ass: 10, label: 'Standard Pattern (20+10)' },
              { mid: 25, ass: 5, label: 'Advanced Pattern (25+5)' }
            ].map(p => (
              <button 
                key={p.mid}
                onClick={() => updatePattern(p.mid, p.ass)}
                disabled={isUpdating}
                className={`w-full p-5 rounded-2xl flex justify-between items-center transition-all border-2 ${config?.mid_max === p.mid ? 'border-blue-600 bg-blue-50/50' : 'border-gray-50 hover:border-blue-200'}`}
              >
                <div className="text-left">
                  <div className="font-black text-gray-800">{p.label}</div>
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">MID: {p.mid} | ASSIGNMENT: {p.ass}</div>
                </div>
                {config?.mid_max === p.mid && <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-indigo-900 to-blue-800 rounded-3xl p-8 text-white shadow-xl">
              <h4 className="font-black text-lg mb-2 uppercase tracking-widest text-blue-200">Department Status</h4>
              <div className="text-4xl font-black mb-1">{branch}</div>
              <div className="text-xs font-bold text-blue-200/60 uppercase tracking-tighter mb-6 underline underline-offset-4 decoration-blue-400">University Affiliated Branch</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="text-[10px] font-black text-blue-200 uppercase mb-1">Academic Year</div>
                  <div className="font-black">2025-2026</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="text-[10px] font-black text-blue-200 uppercase mb-1">Active Sem</div>
                  <div className="font-black">VI (Even)</div>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
