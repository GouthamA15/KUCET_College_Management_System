'use client';

import React from 'react';
import { useStudent } from '@/context/StudentContext';
import Link from 'next/link';
import { getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import useFinancialRows from '@/components/student/useFinancialRows';
import DashboardActionCenter from '@/components/student/DashboardActionCenter';
import Header from '@/components/Header';

const formatCurrency = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return '₹ 0';
  return `₹ ${Number(amount).toLocaleString('en-IN')}`;
};

export default function StudentHomePage() {
  const { studentData, academicPerformance, loading: contextLoading } = useStudent();

  const student = studentData?.student || null;
  const branch = student ? getBranchFromRoll(student.roll_no) : null;
  const { semesterLabel } = student 
    ? calculateYearAndSemester(student.roll_no, studentData?.collegeInfo) 
    : { semesterLabel: '' };
  const academicYear = student ? getResolvedCurrentAcademicYear(student.roll_no, studentData?.collegeInfo) : null;

  const scholarshipList = studentData?.scholarship || [];
  const feeRecords = studentData?.fees || [];
  const { rows = [] } = useFinancialRows(student?.roll_no, scholarshipList, feeRecords, branch);

  const totalGovtPaid = rows.reduce((s, r) => s + Number(r.amount_sanctioned || 0), 0);
  const totalStudentPaid = rows.reduce((s, r) => s + Number(r.student_paid || 0), 0);
  const totalSettled = totalGovtPaid + totalStudentPaid;

  const currentYearRow = rows.find(r => r.labelYear === academicYear);
  const currentPending = currentYearRow ? Number(currentYearRow.pending_fee || 0) : 0;

  if (contextLoading && !student) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-100 border-t-[#0b3578] rounded-full animate-spin"></div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Records</span>
        </div>
      </div>
    );
  }

  if (!student) return null;

  return (
    
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 animate-fadeIn font-sans antialiased text-slate-600">
      
      {/* 1. Refined Identity Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 pb-10 gap-6">
        <div className="space-y-1">
          <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Academic Dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Welcome, {student.name.split(' ')[0]}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-slate-400">
            <span className="text-[10px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{student.roll_no}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs font-medium uppercase tracking-tight">{branch} • {semesterLabel}</span>
          </div>
        </div>
        <Link href="/student/profile" className="px-6 py-2.5 bg-[#0b3578] text-white text-[10px]  font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[#0b3578]/20 hover:scale-105 transition-all">Manage Profile</Link>
      </header>

      {/* 2. Action Center */}
      <DashboardActionCenter student={student} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Main Section */}
        <div className="lg:col-span-8 space-y-14">
          
          {/* Financial Info */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Financial Overview</h2>
              <Link href="/student/finances" className="text-[10px] font-semibold text-[#0b3578] hover:underline uppercase tracking-wider">Breakdown</Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] group hover:border-[#0b3578]/10 transition-all">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Total Settled</p>
                <div className="flex items-baseline gap-1">
                   <p className="text-3xl font-semibold text-slate-800 tracking-tight">{formatCurrency(totalSettled)}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                   <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">Verified Payments</span>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] group hover:border-[#0b3578]/10 transition-all">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                   Pending Balance
                   <span className="text-[9px] font-medium bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">{academicYear}</span>
                </p>
                <p className={`text-3xl font-semibold tracking-tight ${currentPending > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrency(currentPending)}</p>
                <div className="mt-4 flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${currentPending > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                   <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">{currentPending > 0 ? 'Due for this session' : 'Account cleared'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Course Records - High Density List */}
          <section className="space-y-6">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Academic Records</h2>
                <Link href="/student/academics" className="text-[10px] font-semibold text-[#0b3578] hover:underline uppercase tracking-wider">Full Progress</Link>
             </div>

             <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                {academicPerformance && academicPerformance.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {academicPerformance.slice(0, 5).map((sub, i) => (
                      <div key={i} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-100 group-hover:bg-white group-hover:border-[#0b3578]/20 group-hover:text-[#0b3578] transition-all">
                              0{i + 1}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-semibold text-slate-700 leading-tight tracking-tight group-hover:text-slate-900 transition-colors">{sub.subject_name}</h4>
                              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{sub.subject_code} • {sub.faculty_name || 'TBA'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-right hidden sm:block">
                              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Attendance</p>
                              <p className="text-sm font-semibold text-slate-600">{sub.attendance_percentage}%</p>
                            </div>
                            <svg className="w-4 h-4 text-slate-200 group-hover:text-[#0b3578] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-300 text-xs font-semibold uppercase tracking-widest">No curriculum records</div>
                )}
             </div>
          </section>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-12">
          
          {/* Bulletins - Minimalist Timeline */}
          <section className="space-y-8">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Campus Bulletins</h3>
                <Link href="#" className="text-[9px] font-bold text-[#0b3578] uppercase tracking-widest hover:opacity-60">Archive</Link>
             </div>
             
             <div className="space-y-8 border-l border-slate-100 ml-1 pl-6">
                {[
                  { title: 'Library Extensions', desc: 'Operating hours extended until 8 PM for exams.', date: 'Today' },
                  { title: 'Internal Marks Review', desc: 'Verify your S1 internal marks in the academics tab.', date: 'Yesterday' }
                ].map((notice, i) => (
                  <div key={i} className="relative group cursor-pointer">
                     <div className="absolute -left-[28.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-[#0b3578] transition-colors shadow-[0_0_0_4px_white]"></div>
                     <p className="text-[9px] font-bold text-slate-300 uppercase mb-1.5 tracking-wider">{notice.date}</p>
                     <h4 className="text-sm font-semibold text-slate-700 group-hover:text-[#0b3578] transition-colors leading-snug">{notice.title}</h4>
                     <p className="text-xs text-slate-400 mt-1 leading-relaxed font-medium line-clamp-2">{notice.desc}</p>
                  </div>
                ))}
             </div>
          </section>

          {/* Quick Hub - Softer Colors */}
          <section className="p-8 rounded-2xl bg-[#f8faff] border border-blue-50 shadow-sm space-y-6">
             <h3 className="text-[10px] font-bold text-[#0b3578]/40 uppercase tracking-[0.2em]">Resource Center</h3>
             <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Schedule', route: '/student/timetable', icon: '📅' },
                  { label: 'Syllabus', route: '/student/academics', icon: '📚' },
                  { label: 'Certificates', route: '/student/requests/certificates', icon: '📜' },
                  
                ].map((item) => (
                  <Link key={item.label} href={item.route} className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl hover:border-[#0b3578]/20 hover:shadow-md transition-all group">
                    <span className="text-lg mb-2 opacity-80 group-hover:scale-110 transition-transform">{item.icon}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-[#0b3578] transition-colors">{item.label}</span>
                  </Link>
                ))}
             </div>
             <div className="pt-4 border-t border-blue-100/50">
                <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">
                  For administrative support, please contact the departmental clerk during office hours.
                </p>
             </div>
          </section>

        </div>

      </div>
    </div>
  );
}