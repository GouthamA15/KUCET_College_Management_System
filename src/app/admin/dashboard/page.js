"use client";

import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';
import StudentProfileCard from '@/components/StudentProfileCard';
import { useRef } from 'react';
import { useEffect, useState } from 'react';

const BRANCHES = [
  { code: '09', name: 'CSE' },
  { code: '30', name: 'CSD' },
  { code: '15', name: 'ECE' },
  { code: '12', name: 'EEE' },
  { code: '00', name: 'CIVIL' },
  { code: '18', name: 'IT' },
  { code: '03', name: 'MECH' },
];

const YEARS = ['2022', '2023', '2024', '2025'];

export default function AdminDashboardPage() {
  const [totalClerks, setTotalClerks] = useState(0);
  const [activeClerks, setActiveClerks] = useState(0);
  const [studentCounts, setStudentCounts] = useState({ '22': 0, '23': 0, '24': 0, '25': 0, total: 0 });
  const [searchRoll, setSearchRoll] = useState('');
  const [searchedStudent, setSearchedStudent] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allError, setAllError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('09');
  const [selectedYear, setSelectedYear] = useState('2022');

  useEffect(() => {
    // Fetch clerk stats
    fetch('/api/admin/clerks')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setTotalClerks(data.length || 0);
        setActiveClerks(data.filter(c => c.is_active).length || 0);
      });
    // Fetch student stats (simulate for now)
    setStudentCounts({ '22': 120, '23': 130, '24': 110, '25': 100, total: 460 });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchedStudent(null);
    if (!searchRoll.trim()) {
      setSearchError('Please enter a roll number.');
      return;
    }
    try {
      const res = await fetch(`/api/clerk/students/${encodeURIComponent(searchRoll.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.student && data.student.rollno) {
          setSearchedStudent({
            roll_no: data.student.rollno,
            name: data.student.student_name,
            father_name: data.student.father_name,
            gender: data.student.gender,
            category: data.student.category,
            phone: data.student.phone_no
          });
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
      const res = await fetch(`/api/clerk/students?year=${selectedYear}&branch=${selectedBranch}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.students) && data.students.length > 0) {
          setAllStudents(data.students.map(s => ({
            roll_no: s.rollno,
            name: s.student_name,
            father_name: s.father_name,
            gender: s.gender,
            category: s.category,
            phone: s.phone_no
          })));
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

  return (
    <>
      <Header />
      <AdminNavbar />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
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
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <a href="/admin/manage-clerks" className="bg-blue-100 text-blue-900 px-4 py-2 rounded-lg font-semibold hover:bg-blue-200 transition-all cursor-pointer text-center">Manage Clerks</a>
            <a href="/admin/create-clerk" className="bg-green-100 text-green-900 px-4 py-2 rounded-lg font-semibold hover:bg-green-200 transition-all cursor-pointer text-center">Create Clerk</a>
          </div>
          <div className="w-full grid grid-cols-1 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-blue-900">Total Clerks</span>
              <span className="text-xl font-bold text-blue-700">{totalClerks}</span>
            </div>
            <div className="bg-green-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-green-900">Active Clerks</span>
              <span className="text-xl font-bold text-green-700">{activeClerks}</span>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-yellow-900">Pending Requests</span>
              <span className="text-xl font-bold text-yellow-700">0</span>
            </div>
          </div>
          <div className="w-full mb-4">
            <h2 className="text-lg font-semibold text-[#0b3578] mb-2">Student Counts (CSE Branch)</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded p-2 flex justify-between"><span>2022</span><span>{studentCounts['22']}</span></div>
              <div className="bg-gray-50 rounded p-2 flex justify-between"><span>2023</span><span>{studentCounts['23']}</span></div>
              <div className="bg-gray-50 rounded p-2 flex justify-between"><span>2024</span><span>{studentCounts['24']}</span></div>
              <div className="bg-gray-50 rounded p-2 flex justify-between"><span>2025</span><span>{studentCounts['25']}</span></div>
            </div>
            <div className="bg-blue-100 rounded p-2 flex justify-between mt-2 font-bold"><span>Total</span><span>{studentCounts.total}</span></div>
          </div>
        </div>
        {/* All students section */}
        <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-[#0b3578]">All Students</h2>
            <div className="flex gap-2 items-center">
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                {BRANCHES.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                {YEARS.map(y => (
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