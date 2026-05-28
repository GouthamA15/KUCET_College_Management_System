'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export default function ClassList() {
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchRoll, setSearchRoll] = useState('');

  const [selectedAY, setSelectedAY] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const res = await fetch('/api/clerk/faculty/assignments');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch assignments');
        setAssignments(data.data || []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchAssignments();
  }, []);

  const years = useMemo(() => Array.from(new Set(assignments.map(a => a.academic_year))).sort((a,b)=> b.localeCompare(a)), [assignments]);
  const branches = useMemo(() => Array.from(new Set(assignments.filter(a => (!selectedAY || a.academic_year === selectedAY)).map(a => a.branch))).sort(), [assignments, selectedAY]);
  const semesters = useMemo(() => Array.from(new Set(assignments.filter(a => (!selectedAY || a.academic_year === selectedAY) && (!selectedBranch || a.branch === selectedBranch)).map(a => a.semester))).sort((a,b)=> parseInt(a)-parseInt(b)), [assignments, selectedAY, selectedBranch]);
  const filteredAssignments = useMemo(() => assignments.filter(a => (!selectedAY || a.academic_year === selectedAY) && (!selectedBranch || a.branch === selectedBranch) && (!selectedSemester || String(a.semester) === String(selectedSemester))), [assignments, selectedAY, selectedBranch, selectedSemester]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedAssignmentId) { setStudents([]); return; }
      setLoadingStudents(true);
      try {
        const res = await fetch(`/api/clerk/faculty/students?assignment_id=${selectedAssignmentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
        setStudents(data.data || []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [selectedAssignmentId]);

  const visibleStudents = useMemo(() => {
    const list = students || [];
    if (!searchRoll) return list;
    return list.filter(s => (s.roll_no || '').toLowerCase().includes(searchRoll.toLowerCase()));
  }, [students, searchRoll]);

  void loadingAssignments;

  return (
    <section className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Class Lists</h2>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-1">Filter by assignment to view roster.</p>
        </div>
        <div className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-sm uppercase tracking-widest w-fit">
          Total Students: {students.length}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Academic Year</label>
            <select value={selectedAY} onChange={(e)=>setSelectedAY(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700">
            <option value="">Select</option>
            {years.map(ay => (<option key={ay} value={ay}>{ay}</option>))}
          </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
            <select value={selectedBranch} onChange={(e)=>setSelectedBranch(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700 disabled:opacity-60" disabled={!selectedAY}>
            <option value="">Select</option>
            {branches.map(b => (<option key={b} value={b}>{b}</option>))}
          </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Semester</label>
            <select value={selectedSemester} onChange={(e)=>setSelectedSemester(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700 disabled:opacity-60" disabled={!selectedBranch}>
            <option value="">Select</option>
            {semesters.map(s => (<option key={s} value={s}>Sem {s}</option>))}
          </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</label>
            <select value={selectedAssignmentId} onChange={(e)=>setSelectedAssignmentId(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700 disabled:opacity-60" disabled={!selectedSemester}>
            <option value="">Select</option>
            {filteredAssignments.map(a => (
              <option key={a.id} value={a.id}>{a.subject_name} ({a.subject_code})</option>
            ))}
          </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Search Roll No</label>
            <input value={searchRoll} onChange={(e)=>setSearchRoll(e.target.value)} placeholder="e.g. 21K61A0001" className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700" />
          </div>
        </div>

      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-sm">
        {loadingStudents ? (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading students…</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll Number</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {visibleStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] font-mono font-bold text-slate-800">{s.roll_no}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-700 font-semibold">{s.name}</td>
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-[11px] text-slate-500 font-semibold uppercase tracking-widest" colSpan={2}>No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </section>
  );
}