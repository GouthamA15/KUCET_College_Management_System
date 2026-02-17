'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import { useClerk } from '@/context/ClerkContext';
import AttendanceSheet from '@/components/clerk/faculty/AttendanceSheet';

export default function FacultyAttendancePage() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [selectedAY, setSelectedAY] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');

  const [selectedAssignment, setSelectedAssignment] = useState(null);

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
  const subjects = useMemo(() => assignments.filter(a => (!selectedAY || a.academic_year === selectedAY) && (!selectedBranch || a.branch === selectedBranch) && (!selectedSemester || String(a.semester) === String(selectedSemester))), [assignments, selectedAY, selectedBranch, selectedSemester]);

  useEffect(() => {
    // When all filters selected, pick matching assignment
    if (selectedAY && selectedBranch && selectedSemester && selectedSubjectCode) {
      const match = assignments.find(a => a.academic_year === selectedAY && a.branch === selectedBranch && String(a.semester) === String(selectedSemester) && a.subject_code === selectedSubjectCode);
      setSelectedAssignment(match || null);
    } else {
      setSelectedAssignment(null);
    }
  }, [selectedAY, selectedBranch, selectedSemester, selectedSubjectCode, assignments]);

  const resetSelection = () => {
    setSelectedSubjectCode('');
    setSelectedSemester('');
    setSelectedBranch('');
    setSelectedAY('');
    setSelectedAssignment(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Attendance</h1>
          <p className="text-gray-600">Select a subject to manage attendance.</p>
        </div>

        {!selectedAssignment && (
          <div className="bg-white border rounded p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <select value={selectedSubjectCode} onChange={(e)=>setSelectedSubjectCode(e.target.value)} className="w-full p-2 border rounded bg-white" disabled={!selectedSemester}>
                  <option value="">Select</option>
                  {subjects.map(s => (<option key={s.id} value={s.subject_code}>{s.subject_name} ({s.subject_code})</option>))}
                </select>
              </div>
            </div>
          </div>
        )}

        {selectedAssignment ? (
          <AttendanceSheet assignment={selectedAssignment} onBack={resetSelection} />
        ) : (
          loadingAssignments ? <div className="text-center py-6">Loading assignments...</div> : null
        )}
      </main>
      <Footer />
    </div>
  );
}