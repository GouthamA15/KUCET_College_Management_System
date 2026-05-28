"use client";

import StudentProfileCard from '@/components/StudentProfileCard';
import { useRef, useEffect, useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import CollegeInfoEditor from '@/components/admin/CollegeInfoEditor';
import { validateRollNo } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import FacultyInterestsManager from '@/components/admin/FacultyInterestsManager';
import { getNowSync } from '@/lib/clock';

const BRANCHES = COLLEGE_CONFIG.branches;

const currentYear = getNowSync().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => (currentYear - i).toString()).reverse();

export default function AdminDashboardPage() {
  const { clerks, studentStats, loading: contextLoading } = useAdmin();
  const [searchRoll, setSearchRoll] = useState('');
  const [searchedStudent, setSearchedStudent] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allError, setAllError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [selectedStudyingYear, setSelectedStudyingYear] = useState('1'); 
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'faculty'

  const totalClerks = Array.isArray(clerks) ? clerks.length : 0;
  const activeClerks = Array.isArray(clerks) ? clerks.filter(c => c.is_active).length : 0;

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
    <div className="flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0b3578] mb-6 tracking-tight uppercase">Admin Dashboard</h1>
        <form onSubmit={handleSearch} className="w-full flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text"
            placeholder="Search by Roll No."
            value={searchRoll}
            onChange={e => setSearchRoll(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-transparent text-gray-800"
          />
          <button type="submit" className="bg-[#0b3578] text-white px-4 py-2 rounded font-semibold hover:bg-[#0a2d66] transition-all cursor-pointer uppercase text-sm tracking-wide">Search</button>
        </form>

        <div className="w-full flex border-b mb-6">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-2 font-semibold transition uppercase text-xs tracking-widest ${activeTab === 'stats' ? 'text-[#0b3578] border-b-2 border-[#0b3578]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-6 py-2 font-semibold transition uppercase text-xs tracking-widest ${activeTab === 'faculty' ? 'text-[#0b3578] border-b-2 border-[#0b3578]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Faculty Management
          </button>
        </div>

        {searchError && <div className="text-red-600 text-sm mb-2">{searchError}</div>}
        {searchedStudent && (
          <div className="w-full mb-6">
            <StudentProfileCard student={searchedStudent} />
          </div>
        )}

        {activeTab === 'stats' ? (
          <>
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                <span className="font-semibold text-slate-600 uppercase text-[10px] tracking-widest">Total Clerks</span>
                <span className="text-xl font-bold text-[#0b3578]">{totalClerks}</span>
              </div>
              <div className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                <span className="font-semibold text-slate-600 uppercase text-[10px] tracking-widest">Active Clerks</span>
                <span className="text-xl font-bold text-green-700">{activeClerks}</span>
              </div>
              <div className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                <span className="font-semibold text-slate-600 uppercase text-[10px] tracking-widest">Total Students</span>
                <span className="text-xl font-bold text-purple-700">{totalStudentsInCollege}</span>
              </div>
            </div>

            <div className="w-full mb-4 overflow-x-auto">
              <h2 className="text-sm font-bold text-[#0b3578] mb-4 uppercase tracking-wider">Student Statistics</h2>
              {studentStats ? (
                <table className="min-w-full bg-white border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="py-2 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch</th>
                      {studyYears.map(year => (
                        <th key={year} className="py-2 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Year {year}</th>
                      ))}
                      <th className="py-2 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(studentStats).sort().map(branch => (
                      <tr key={branch} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 border-b border-slate-100 text-xs text-slate-800 font-bold uppercase">{branch}</td>
                        {studyYears.map(year => (
                          <td key={year} className="py-2 px-4 border-b border-slate-100 text-center text-xs text-slate-600">{studentStats[branch][year]}</td>
                        ))}
                        <td className="py-2 px-4 border-b border-slate-100 text-center text-xs text-slate-900 font-black">{studentStats[branch].total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-500 italic">Loading student stats...</p>
              )}
            </div>
          </>
        ) : (
          <div className="w-full">
            <FacultyInterestsManager />
          </div>
        )}

      </div>
      <div className="w-full max-w-4xl mx-auto mt-8">
        <CollegeInfoEditor />
      </div>
      <div className="w-full max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-[#0b3578] uppercase tracking-wider">All Students</h2>
          <div className="flex gap-2 items-center">
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs">
              {BRANCHES.map(b => (
                <option key={b.code} value={b.name}>{b.name}</option>
              ))}
            </select>
            <select value={selectedStudyingYear} onChange={e => setSelectedStudyingYear(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs">
              {studyYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={handleFetchAllStudents} className="bg-[#0b3578] text-white px-4 py-1 rounded font-bold hover:bg-[#0a2d66] transition-all cursor-pointer uppercase text-[10px] tracking-widest">Fetch</button>
          </div>
        </div>
        {loadingAll && <div className="text-blue-700 text-xs animate-pulse">Loading students...</div>}
        {allError && <div className="text-red-600 text-[10px] mb-2">{allError}</div>}
        <div className="max-h-[400px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 custom-scrollbar">
          {allStudents.map(student => (
            <StudentProfileCard key={student.roll_no} student={student} />
          ))}
        </div>
      </div>
    </div>
  );
}