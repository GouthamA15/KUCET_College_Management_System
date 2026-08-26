'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { BookOpen, User, Trash2 } from 'lucide-react';

export default function SubjectAssignmentsList() {
  const { staffData, refreshFaculty } = useStaff();
  const [assignments, setAssignments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]); // Needed to pick a subject for assignment
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedSem, setSelectedSem] = useState('ALL');
  
  // Assign state
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ faculty_id: '', subject_code: '', semester: 1 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!staffData?.is_hod) return;
      try {
        setLoading(true);
        const [asgnRes, facRes, subRes] = await Promise.all([
          fetch('/api/staff/hod/subject-assignments'),
          fetch('/api/staff/hod/active-faculty'),
          fetch('/api/staff/hod/branch-subjects')
        ]);
        
        if (isMounted) {
          if (asgnRes.ok) {
            const data = await asgnRes.json();
            setAssignments(data.data || []);
          }
          if (facRes.ok) {
            const data = await facRes.json();
            setFaculty(data.data || []);
          }
          if (subRes.ok) {
            const data = await subRes.json();
            setSubjects(data.data || []);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load assignments data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [staffData?.is_hod]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.faculty_id || !assignForm.subject_code || !assignForm.semester) {
      return toast.error('Please fill all fields');
    }
    
    // Find subject name to pass
    const subject = subjects.find(s => s.subject_code === assignForm.subject_code);
    if (!subject) return toast.error('Invalid subject code');

    setIsSaving(true);
    try {
      const res = await fetch('/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faculty_id: assignForm.faculty_id,
          subject_code: subject.subject_code,
          subject_name: subject.subject_name,
          branch: subject.branch, // branch is needed
          semester: assignForm.semester,
          academic_year: staffData?.academic_year || '2025-26'
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Subject assigned successfully');
        const asgnRes = await fetch('/api/staff/hod/subject-assignments');
        if (asgnRes.ok) {
          const asgnData = await asgnRes.json();
          setAssignments(asgnData.data || []);
        }
        setIsAssigning(false);
        setAssignForm({ faculty_id: '', subject_code: '', semester: 1 });
        if (refreshFaculty) refreshFaculty();
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (_err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Are you sure you want to revoke this assignment?')) return;
    try {
      const res = await fetch(`/api/staff/hod/subject-assignments?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Assignment revoked');
        setAssignments(prev => prev.filter(a => a.id !== id));
        if (refreshFaculty) refreshFaculty();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to revoke');
      }
    } catch (_e) {
      toast.error('Network error');
    }
  };

  const filteredAssignments = useMemo(() => {
    if (selectedSem === 'ALL') return assignments;
    return assignments.filter(a => String(a.course_semester) === String(selectedSem));
  }, [assignments, selectedSem]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div>
      </div>
    );
  }

  // Active faculty for dropdown
  const activeFaculty = faculty.filter(f => f.account_status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Subject Assignments</h2>
          <p className="text-sm text-gray-500">Track and manage active faculty teaching assignments.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <span className="text-xs font-bold text-gray-500 px-2 uppercase">Sem:</span>
            {['ALL', 1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
              <button
                key={sem}
                onClick={() => setSelectedSem(sem)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${selectedSem === sem ? 'bg-white text-[#0b3578] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {sem}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsAssigning(!isAssigning)}
            className="bg-[#0b3578] text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg shadow-sm hover:bg-blue-900 transition-colors whitespace-nowrap"
          >
            {isAssigning ? 'Cancel Assignment' : '+ Direct Assign'}
          </button>
        </div>
      </div>

      {isAssigning && (
        <form onSubmit={handleAssignSubmit} className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 animate-fadeIn">
          <h3 className="font-bold text-[#0b3578] mb-4">Directly Assign Subject to Faculty</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Faculty</label>
              <select
                value={assignForm.faculty_id}
                onChange={(e) => setAssignForm({...assignForm, faculty_id: e.target.value})}
                className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:border-[#0b3578]"
                required
              >
                <option value="">-- Select Faculty --</option>
                {activeFaculty.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.employee_id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Semester</label>
              <select
                value={assignForm.semester}
                onChange={(e) => setAssignForm({...assignForm, semester: parseInt(e.target.value), subject_code: ''})}
                className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:border-[#0b3578]"
                required
              >
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Subject</label>
              <select
                value={assignForm.subject_code}
                onChange={(e) => setAssignForm({...assignForm, subject_code: e.target.value})}
                className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:border-[#0b3578]"
                required
              >
                <option value="">-- Select Subject --</option>
                {subjects.filter(s => s.semester === assignForm.semester).map(s => (
                  <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
              {isSaving ? 'Assigning...' : 'Assign Faculty'}
            </button>
          </div>
        </form>
      )}

      {filteredAssignments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map(asgn => (
            <div key={asgn.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <span className="bg-blue-100 text-[#0b3578] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border border-blue-200">
                  {asgn.subject_code}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-sm border border-gray-200">
                  Sem {asgn.course_semester}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-900 leading-tight mb-4">{asgn.subject_name}</h3>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <User size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">{asgn.faculty_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Branch: {asgn.branch}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button 
                  onClick={() => handleRevoke(asgn.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md"
                >
                  <Trash2 size={14} /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 p-8 border border-dashed border-gray-300 text-center rounded-xl">
          <p className="text-gray-500 font-medium">No active assignments found for Semester {selectedSem}.</p>
        </div>
      )}
    </div>
  );
}
