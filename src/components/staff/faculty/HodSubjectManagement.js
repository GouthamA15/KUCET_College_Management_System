import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { Edit2, Trash2, BookOpen } from 'lucide-react';
import SubjectModal from './SubjectModal';

export default function HodSubjectManagement() {
  const { staffData, refreshFaculty } = useStaff();
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState(1);
  const [assigningSubject, setAssigningSubject] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Subject CRUD state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/staff/hod/branch-subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.data || []);
      }
    } catch (_e) {
      // Ignored
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!staffData?.is_hod) return;
      try {
        setLoading(true);
        const [subRes, asgnRes, facRes] = await Promise.all([
          fetch('/api/staff/hod/branch-subjects'),
          fetch('/api/staff/hod/subject-assignments'),
          fetch('/api/staff/hod/faculty-load')
        ]);
        
        if (isMounted) {
          if (subRes.ok) {
            const data = await subRes.json();
            setSubjects(data.data || []);
          }
          if (asgnRes.ok) {
            const data = await asgnRes.json();
            setAssignments(data.data || []);
          }
          if (facRes.ok) {
            const data = await facRes.json();
            setFaculty(data.data || []);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load department data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [staffData?.is_hod]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) return toast.error('Please select a faculty member');
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faculty_id: selectedFacultyId,
          subject_code: assigningSubject.subject_code,
          subject_name: assigningSubject.subject_name,
          semester: assigningSubject.semester,
          academic_year: staffData?.academic_year
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Subject assigned successfully');
        // Refresh assignments
        const asgnRes = await fetch('/api/staff/hod/subject-assignments');
        if (asgnRes.ok) {
          const asgnData = await asgnRes.json();
          setAssignments(asgnData.data || []);
        }
        setAssigningSubject(null);
        setSelectedFacultyId('');
        
        // Refresh the faculty context if the HOD assigned it to themselves,
        // or just unconditionally refresh to keep "My Subjects" in sync.
        if (refreshFaculty) {
          refreshFaculty();
        }
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (_err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubjectSubmit = async (formData) => {
    try {
      const res = await fetch('/api/staff/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SUBJECT',
          subject: formData
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Subject saved successfully');
        setIsModalOpen(false);
        setEditingSubject(null);
        fetchSubjects();
      } else {
        toast.error(data.error || 'Failed to save subject');
      }
    } catch (_e) {
      toast.error('Network error');
    }
  };

  const handleDeleteSubject = async (subjectCode) => {
    if (!confirm('Are you sure you want to remove this subject mapping? This will be prevented if there are active academic records.')) return;
    try {
      const res = await fetch('/api/staff/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_SUBJECT',
          subject: { subject_code: subjectCode }
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Subject mapping removed');
        fetchSubjects();
      } else {
        toast.error(data.error || 'Failed to remove subject');
      }
    } catch (_e) {
      toast.error('Network error');
    }
  };

  const currentSemSubjects = useMemo(() => {
    return subjects.filter(s => s.semester === selectedSem);
  }, [subjects, selectedSem]);

  if (!staffData?.is_hod) return null;

  if (loading) {
    return <div className="text-center py-10 text-slate-500 font-medium text-sm">Loading Department Subjects...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-md shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight uppercase">Subjects Management</h2>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
            Dept: {staffData?.department_name || staffData?.branch} | AY: {staffData?.academic_year || '2025-26'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Semester:</label>
            <div className="flex bg-slate-100 rounded-md border border-slate-200 p-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <button
                  key={sem}
                  onClick={() => setSelectedSem(sem)}
                  className={`w-8 h-8 rounded text-xs font-bold transition-colors ${selectedSem === sem ? 'bg-[#0b3578] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setEditingSubject(null); setIsModalOpen(true); }}
            className="bg-[#0b3578] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded flex items-center gap-1.5 hover:bg-blue-900 transition-colors shadow-sm"
          >
            <BookOpen size={14} /> Add Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentSemSubjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-md">
            No subjects configured for Semester {selectedSem}.
          </div>
        ) : (
          currentSemSubjects.map(sub => {
            const subjectAssignments = assignments.filter(a => a.subject_code === sub.subject_code && a.course_semester === sub.semester);
            
            return (
              <div key={sub.subject_code} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-black text-[#0b3578] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-sm uppercase tracking-widest">{sub.subject_code}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm uppercase tracking-widest">{sub.subject_type || 'THEORY'}</span>
                      <button onClick={() => { setEditingSubject(sub); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 transition-colors" title="Edit Subject">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteSubject(sub.subject_code)} className="text-slate-400 hover:text-red-600 transition-colors" title="Remove Subject">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 leading-snug line-clamp-2">{sub.subject_name}</h3>
                </div>
                
                <div className="mt-auto space-y-3">
                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Current Assignments</h4>
                    {subjectAssignments.length > 0 ? (
                      <div className="space-y-2">
                        {subjectAssignments.map(asgn => (
                          <div key={asgn.id} className="text-xs font-medium text-slate-700 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 flex items-center justify-between">
                            <span className="truncate pr-2">{asgn.faculty_name}</span>
                            <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded-sm">Assigned</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] italic text-slate-400">Not assigned</div>
                    )}
                  </div>
                  
                  {assigningSubject?.subject_code === sub.subject_code ? (
                    <form onSubmit={handleAssignSubmit} className="bg-slate-50 p-3 rounded-md border border-slate-200 mt-2 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Select Faculty</label>
                        <select
                          value={selectedFacultyId}
                          onChange={(e) => setSelectedFacultyId(e.target.value)}
                          className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#0b3578] outline-none"
                          required
                        >
                          <option value="">-- Choose Faculty --</option>
                          {faculty.map(fac => (
                            <option key={fac.id} value={fac.id}>{fac.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={isSaving} className="flex-1 bg-[#0b3578] text-white text-[10px] font-bold uppercase tracking-widest py-1.5 rounded hover:bg-blue-900 transition-colors disabled:opacity-50">
                          Confirm
                        </button>
                        <button type="button" onClick={() => setAssigningSubject(null)} className="flex-1 bg-white text-slate-600 border border-slate-300 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      onClick={() => { setAssigningSubject(sub); setSelectedFacultyId(''); }}
                      className="w-full text-[10px] font-bold uppercase tracking-widest text-center py-2 border border-slate-200 rounded-md hover:bg-slate-50 text-[#0b3578] hover:text-blue-900 transition-colors"
                    >
                      + Assign Faculty
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <SubjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubjectSubmit}
        initialData={editingSubject}
        selectedSem={selectedSem}
      />
    </div>
  );
}
