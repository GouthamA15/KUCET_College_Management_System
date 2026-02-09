"use client";

import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';
import StudentProfileCard from '@/components/StudentProfileCard';
import { useRef } from 'react';
import { useEffect, useState } from 'react';
import CollegeInfoEditor from '@/components/admin/CollegeInfoEditor';
import { validateRollNo } from '@/lib/rollNumber'; // Added this line back

const BRANCHES = [
  { code: '09', name: 'CSE' },
  { code: '30', name: 'CSD' },
  { code: '15', name: 'ECE' },
  { code: '12', name: 'EEE' },
  { code: '00', name: 'CIVIL' },
  { code: '18', name: 'IT' },
  { code: '03', name: 'MECH' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => (currentYear - i).toString()).reverse();

export default function AdminDashboardPage() {
  const [totalClerks, setTotalClerks] = useState(0);
  const [activeClerks, setActiveClerks] = useState(0);
  const [studentStats, setStudentStats] = useState(null); // Changed from studentCounts
  const [searchRoll, setSearchRoll] = useState('');
  const [searchedStudent, setSearchedStudent] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allError, setAllError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [selectedStudyingYear, setSelectedStudyingYear] = useState('1'); // Changed to studying year (1-4)

  useEffect(() => {
    // Fetch clerk stats
    fetch('/api/admin/clerks')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setTotalClerks(data.length || 0);
        setActiveClerks(data.filter(c => c.is_active).length || 0);
      });

    // Fetch student stats
    fetch('/api/admin/student-stats')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            setStudentStats(data);
        });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchedStudent(null);
    if (!searchRoll.trim()) {
      setSearchError('Please enter a roll number.');
      return;
    }
    const { isValid } = validateRollNo(searchRoll.trim());
    if (!isValid) {
      setSearchError('Invalid Roll Number format.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(searchRoll.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.student) {
          setSearchedStudent(data.student);
        } else {
          setSearchError('No student found for this roll number.');
        }
      } else {
        setSearchError('No student found for this roll number.');
      }
    } catch {
      setSearchError('Error searching for student.');
    }
  };

  const handleFetchAllStudents = async () => {
    setLoadingAll(true);
    setAllError('');
    setAllStudents([]);
    try {
      const res = await fetch(`/api/admin/students?studyingYear=${selectedStudyingYear}&branch=${selectedBranch}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.students) && data.students.length > 0) {
          setAllStudents(data.students);
        } else {
          setAllError('No students found.');
        }
      } else {
        setAllError('No students found.');
      }
    } catch {
      setAllError('Error fetching students.');
    }
    setLoadingAll(false);
  };
  
  const studyYears = [1, 2, 3, 4];

  // Calculate total students in college
  const totalStudentsInCollege = studentStats 
    ? Object.values(studentStats).reduce((sum, branchStats) => sum + branchStats.total, 0)
    : 0;

  return (
    <>
      <Header />
      <AdminNavbar />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Admin Dashboard</h1>
          <form onSubmit={handleSearch} className="w-full flex flex-col sm:flex-row gap-2 mb-6">
            <input
              type="text"
              placeholder="Search by Roll No."
              value={searchRoll}
              onChange={e => setSearchRoll(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent text-gray-800"
            />
            <button type="submit" className="bg-[#0b3578] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0a2d66] transition-all cursor-pointer">Search</button>
          </form>
          {searchError && <div className="text-red-600 text-sm mb-2">{searchError}</div>}
          {searchedStudent && (
            <div className="w-full mb-6">
              <StudentProfileCard student={searchedStudent} />
            </div>
          )}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-blue-900">Total Clerks</span>
              <span className="text-xl font-bold text-blue-700">{totalClerks}</span>
            </div>
            <div className="bg-green-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-green-900">Active Clerks</span>
              <span className="text-xl font-bold text-green-700">{activeClerks}</span>
            </div>
            {/* New card for Total Students in College */}
            <div className="bg-purple-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-purple-900">Total Students</span>
              <span className="text-xl font-bold text-purple-700">{totalStudentsInCollege}</span>
            </div>
            {/* Original "Pending Requests" card moved or replaced */}
            {/* If you want to keep "Pending Requests", you can add it back here */}
            {/* <div className="bg-yellow-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-yellow-900">Pending Requests</span>
              <span className="text-xl font-bold text-yellow-700">0</span>
            </div> */}
          </div>

          <div className="w-full mb-4 overflow-x-auto">
            <h2 className="text-lg font-semibold text-[#0b3578] mb-2">Student Statistics</h2>
            {studentStats ? (
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Branch</th>
                    {studyYears.map(year => (
                      <th key={year} className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Year {year}</th>
                    ))}
                    <th className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(studentStats).sort().map(branch => (
                    <tr key={branch} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border-b text-sm text-gray-800 font-medium">{branch}</td>
                      {studyYears.map(year => (
                        <td key={year} className="py-2 px-4 border-b text-center text-sm text-gray-800">{studentStats[branch][year]}</td>
                      ))}
                      <td className="py-2 px-4 border-b text-center text-sm text-gray-800 font-bold">{studentStats[branch].total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Loading student stats...</p>
            )}
          </div>

        </div>
          <div className="w-full max-w-4xl mx-auto mt-8">
            <CollegeInfoEditor />
          </div>
        <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-[#0b3578]">All Students</h2>
            <div className="flex gap-2 items-center">
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                {BRANCHES.map(b => (
                  <option key={b.code} value={b.name}>{b.name}</option>
                ))}
              </select>
              <select value={selectedStudyingYear} onChange={e => setSelectedStudyingYear(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                {studyYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button onClick={handleFetchAllStudents} className="bg-[#0b3578] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0a2d66] transition-all cursor-pointer">Fetch</button>
            </div>
          </div>
          {loadingAll && <div className="text-blue-700">Loading students...</div>}
          {allError && <div className="text-red-600 text-sm mb-2">{allError}</div>}
          <div className="max-h-[400px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {allStudents.map(student => (
              <StudentProfileCard key={student.roll_no} student={student} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}