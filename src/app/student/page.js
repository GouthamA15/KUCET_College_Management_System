'use client';

import React from 'react';
import { useStudent } from '@/context/StudentContext';
import Link from 'next/link';
import { getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import useFinancialRows from '@/components/student/useFinancialRows';
import DashboardActionCenter from '@/components/student/DashboardActionCenter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function clampNumber(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function getAttendancePercent(sub) {
  const total = Number(sub?.total_classes || 0);
  const attended = Number(sub?.attended_classes || 0);
  if (total <= 0) return 100;
  return clampNumber((attended / total) * 100, 0, 100);
}

function getAttendanceTone(percent) {
  if (percent >= 75) {
    return {
      label: 'High',
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      accentBorder: 'border-emerald-400',
    };
  }
  if (percent >= 60) {
    return {
      label: 'Medium',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      accentBorder: 'border-amber-400',
    };
  }
  return {
    label: 'Low',
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    accentBorder: 'border-rose-400',
  };
}

function IconBook({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 4.5h10.25c1.24 0 2.25 1.01 2.25 2.25V19c0 .83-.67 1.5-1.5 1.5H7.75C6.23 20.5 5 19.27 5 17.75V6.75C5 5.51 6.01 4.5 7.25 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 7h7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 10h6.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCode({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M9 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 5.5L10.5 18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCpu({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M9 9h6v6H9V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 12H5m14 0h-2M12 7V5m0 14v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 5.75V4.5m8 1.25V4.5M8 19.5v-1.25m8 1.25v-1.25M5.75 8H4.5m1.25 8H4.5m15  -8H18.25m1.25 8H18.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.25 8.25h7.5v7.5h-7.5v-7.5Z" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
    </svg>
  );
}

function IconFlask({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M10 3h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.5 3v6.25l-4.9 7.4A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.5-4.35l-4.9-7.4V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function pickSubjectVisual(subjectName, index) {
  const name = String(subjectName || '').toLowerCase();

  if (/(program|code|data|algo|software|web|computer)/.test(name)) {
    return { Icon: IconCode, ring: 'ring-blue-100', fg: 'text-blue-700', bg: 'bg-blue-50', accent: 'border-blue-400' };
  }
  if (/(network|os|system|architecture|micro|embedded|iot|chip)/.test(name)) {
    return { Icon: IconCpu, ring: 'ring-indigo-100', fg: 'text-indigo-700', bg: 'bg-indigo-50', accent: 'border-indigo-400' };
  }
  if (/(physics|chem|lab|science)/.test(name)) {
    return { Icon: IconFlask, ring: 'ring-emerald-100', fg: 'text-emerald-700', bg: 'bg-emerald-50', accent: 'border-emerald-400' };
  }

  const fallbacks = [
    { Icon: IconBook, ring: 'ring-slate-100', fg: 'text-slate-700', bg: 'bg-slate-50', accent: 'border-slate-300' },
    { Icon: IconBook, ring: 'ring-blue-100', fg: 'text-blue-700', bg: 'bg-blue-50', accent: 'border-blue-400' },
    { Icon: IconBook, ring: 'ring-amber-100', fg: 'text-amber-700', bg: 'bg-amber-50', accent: 'border-amber-400' },
    { Icon: IconBook, ring: 'ring-rose-100', fg: 'text-rose-700', bg: 'bg-rose-50', accent: 'border-rose-400' },
  ];

  return fallbacks[index % fallbacks.length];
}

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

  if (contextLoading && !student) {
    return <LoadingSpinner label="Loading Records" />;
  }

  if (!student) return null;

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-[#F5F7FB]">
      <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 lg:px-8 pt-8 animate-fadeIn antialiased text-slate-700">

      {/* Header: modern gradient */}
      <header className="relative overflow-hidden rounded-[18px] border border-white/60 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1E3A8A] shadow-[0_18px_60px_rgba(30,58,138,0.22)]">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(900px 280px at 18% 18%, rgba(255,255,255,0.32) 0%, transparent 60%), radial-gradient(720px 260px at 92% 38%, rgba(255,255,255,0.18) 0%, transparent 58%)' }} />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-white/75">Academic Dashboard</p>
              <h1 className="text-3xl sm:text-[34px] font-black tracking-tight text-white leading-tight">
                Welcome, {student.name.split(' ')[0]}
              </h1>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/15 text-white border border-white/20 px-2.5 py-1 rounded-full">
                  {student.roll_no}
                </span>
                <span className="text-white/35">•</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
                  {branch} • {semesterLabel}
                </span>
                {academicYear ? (
                  <>
                    <span className="text-white/35">•</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/75">{academicYear}</span>
                  </>
                ) : null}
              </div>

              <p className="text-sm text-white/75 max-w-2xl leading-relaxed pt-2">
                Your attendance, academics, and requests — all in one clean space.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/profile"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#2563EB] text-white text-[12px] font-extrabold uppercase tracking-[0.22em] rounded-[14px] shadow-[0_10px_26px_rgba(37,99,235,0.35)] hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Open Profile
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Action Center */}
      <DashboardActionCenter student={student} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Main Section */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* Course Records - High Density List */}
          <section className="space-y-6">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.22em]">Academic Records</h2>
                <Link href="/student/academics" className="text-[10px] font-extrabold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest">Full Progress</Link>
             </div>

             <div className="rounded-[18px] overflow-hidden border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_14px_46px_rgba(15,23,42,0.08)]">
                {academicPerformance && academicPerformance.length > 0 ? (
                  <div className="divide-y divide-slate-100/70">
                    {academicPerformance.slice(0, 5).map((sub, i) => (
                      (() => {
                        const percent = getAttendancePercent(sub);
                        const tone = getAttendanceTone(percent);
                        const visual = pickSubjectVisual(sub.subject_name, i);
                        const VisualIcon = visual.Icon;

                        return (
                          <div
                            key={i}
                            className={
                              'group flex items-center justify-between gap-6 p-5 sm:p-6 cursor-pointer transition-all ' +
                              'hover:bg-white/70 hover:-translate-y-[1px] ' +
                              'border-l-4 ' +
                              tone.accentBorder
                            }
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={"h-10 w-10 rounded-[14px] ring-1 " + visual.ring + " " + visual.bg + " flex items-center justify-center"}>
                                <VisualIcon className={"h-5 w-5 " + visual.fg} />
                              </div>

                              <div className="min-w-0">
                                <h4 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-tight tracking-tight truncate">
                                  {sub.subject_name}
                                </h4>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1 truncate">
                                  {sub.subject_code} • {sub.faculty_name || 'TBA'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="hidden sm:flex flex-col items-end">
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.22em]">Attendance</p>
                                <div className={"mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 " + tone.border + ' ' + tone.bg}>
                                  <span className={"h-2 w-2 rounded-full " + tone.dot} aria-hidden="true" />
                                  <span className={"text-[11px] font-extrabold " + tone.text}>{percent.toFixed(1)}%</span>
                                  <span className={"text-[10px] font-extrabold uppercase tracking-wider " + tone.text + '/80'}>{tone.label}</span>
                                </div>
                              </div>

                              <svg className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-400 text-xs font-extrabold uppercase tracking-[0.22em]">No curriculum records</div>
                )}
             </div>
          </section>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* Bulletins - Minimalist Timeline
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
          </section> */}

          {/* Quick Hub - Softer Colors */}
          <section className="p-8 rounded-2xl bg-[#f8faff] border border-slate-203/90 ring-1 ring-slate-200/60 shadow-sm space-y-6">
             <h3 className="text-[10px] font-bold text-[#0b3578]/40 uppercase tracking-[0.2em]">Resource Center</h3>
             <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Schedule', route: '/student/timetable', icon: '📅' },
                  { label: 'Syllabus', route: '/student/academics', icon: '📚' },
                  { label: 'Certificates', route: '/student/requests/certificates', icon: '📜' },
                  
                ].map((item) => (
                  <Link key={item.label} href={item.route} className="flex flex-col p-4 bg-white border border-slate-200/80 rounded-xl hover:border-[#0b3578]/30 hover:shadow-md transition-all group">
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
    </div>
  );
}