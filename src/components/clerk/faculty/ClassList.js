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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-2">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Class List</h2>
        <div className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
          Total Students: {students.length}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Academic Year</label>
          <select value={selectedAY} onChange={(e)=>setSelectedAY(e.target.value)} className="w-full p-2 border rounded bg-white">
            <option value="">Select</option>
            {years.map(ay => (<option key={ay} value={ay}>{ay}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Branch</label>
          <select value={selectedBranch} onChange={(e)=>setSelectedBranch(e.target.value)} className="w-full p-2 border rounded bg-white" disabled={!selectedAY}>
            <option value="">Select</option>
            {branches.map(b => (<option key={b} value={b}>{b}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Semester</label>
          <select value={selectedSemester} onChange={(e)=>setSelectedSemester(e.target.value)} className="w-full p-2 border rounded bg-white" disabled={!selectedBranch}>
            <option value="">Select</option>
            {semesters.map(s => (<option key={s} value={s}>Sem {s}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
          <select value={selectedAssignmentId} onChange={(e)=>setSelectedAssignmentId(e.target.value)} className="w-full p-2 border rounded bg-white" disabled={!selectedSemester}>
            <option value="">Select</option>
            {filteredAssignments.map(a => (
              <option key={a.id} value={a.id}>{a.subject_name} ({a.subject_code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Search Roll No</label>
          <input value={searchRoll} onChange={(e)=>setSearchRoll(e.target.value)} placeholder="e.g. 21K61A0001" className="w-full p-2 border rounded" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        {loadingStudents ? (
          <div className="text-center py-6">Loading students...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleStudents.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.roll_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.name}</td>
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={2}>No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}