'use client';

import React from 'react';
import { useStudent } from '@/context/StudentContext';
import Link from 'next/link';
import { getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import DashboardActionCenter from '@/components/student/DashboardActionCenter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function clampNumber(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

// Unused icons (IconCalendar, IconGraduationCap, IconIdCard, IconChartBar) removed

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
  const { studentData, collegeInfo, academicPerformance, loading: contextLoading } = useStudent();

  const student = studentData?.student || null;
  const branch = student ? getBranchFromRoll(student.roll_no) : null;
  const { semesterLabel, yearOfStudy, semester } = student
    ? calculateYearAndSemester(student.roll_no, collegeInfo, student.academic_offset_years || 0)
    : { semesterLabel: '', yearOfStudy: null, semester: null };
  const academicYear = student ? getResolvedCurrentAcademicYear(student.roll_no, collegeInfo) : null;

  // overallAttendance calculation removed as metrics row is removed

  if (contextLoading && !student) {
    return <LoadingSpinner label="Loading Records" />;
  }

  if (!student) return null;

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-slate-50 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full lg:min-h-0 px-4 lg:px-8 py-4 lg:py-3 animate-fadeIn antialiased text-slate-700 flex flex-col gap-4 lg:gap-3">

        {/* Header: text-only on mobile, card on desktop */}
        <header className="relative shrink-0 lg:h-auto lg:px-6 lg:py-5 lg:flex lg:items-center lg:overflow-hidden lg:rounded-sm lg:border lg:border-slate-200/80 lg:bg-[#0b3578] lg:shadow-inner">
          <div className="absolute inset-0 hidden lg:block overflow-hidden pointer-events-none">
            {/* Elegant deep gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b3578] via-[#0f3d8a] to-[#1d57b8]" />
            
            {/* Dynamic radial highlights */}
            <div 
              className="absolute -right-10 -top-10 w-72 h-72 rounded-full opacity-25 mix-blend-screen transition-all duration-1000"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)'
              }}
            />
            <div 
              className="absolute right-1/3 -bottom-20 w-96 h-96 rounded-full opacity-20 mix-blend-screen"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)'
              }}
            />

            {/* Microsoft-style glassmorphism bubble accents */}
            <div className="absolute right-[8%] top-[12%] w-14 h-14 rounded-full bg-white/10 backdrop-blur-[1px] border border-white/20 shadow-[0_8px_32px_0_rgba(255,255,255,0.05)] transform hover:scale-105 transition-transform duration-500" />
            <div className="absolute right-[18%] bottom-[-10%] w-20 h-20 rounded-full bg-white/5 backdrop-blur-[2px] border border-white/10 shadow-[0_8px_32px_0_rgba(255,255,255,0.03)]" />
            <div className="absolute right-[28%] top-[35%] w-8 h-8 rounded-full bg-white/10 backdrop-blur-[1px] border border-white/25 shadow-[0_8px_32px_0_rgba(255,255,255,0.05)]" />
            <div className="absolute right-[3%] bottom-[30%] w-10 h-10 rounded-full bg-white/5 backdrop-blur-[1px] border border-white/10 shadow-[0_8px_32px_0_rgba(255,255,255,0.03)]" />
          </div>
          <div className="relative w-full p-0 lg:p-0">
            {/* Mobile Welcome Layout - Unchanged */}
            <div className="lg:hidden flex flex-col justify-between gap-2.5">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-[#0b3578] leading-tight">
                  Welcome, {student.name.split(' ')[0]}
                </h1>

                <div className="flex flex-wrap items-center justify-start gap-2 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#0b3578]/5 text-[#0b3578] border border-[#0b3578]/10 px-1.5 py-0.5 rounded-full">
                    {student.roll_no}
                  </span>
                  <span className="text-slate-300 inline">•</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {branch} • {semesterLabel}
                  </span>
                  {academicYear ? (
                    <>
                      <span className="text-slate-300 inline">•</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{academicYear}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Desktop Welcome Layout - Title case name with metadata under it */}
            <div className="hidden lg:block text-left text-white">
              <h1 className="text-2xl font-bold tracking-tight text-white select-none">
                Welcome back, {toTitleCase(student.name)}
              </h1>
              <div className="mt-2 text-xs font-medium text-blue-100/90 space-y-0.5 select-none">
                <div>B.Tech ({branch})</div>
                <div>Year {yearOfStudy} • Semester {semester}</div>
                <div>Academic Year {academicYear}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:flex lg:flex-col lg:gap-3 lg:flex-1 lg:min-h-0">

          {/* Div 1: contains Priority Actions (uses contents display on desktop) */}
          <div className="order-1 lg:order-none lg:contents flex flex-col gap-4 lg:gap-3 lg:min-h-0">
            <div className="lg:order-1 lg:shrink-0 lg:min-h-0 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <DashboardActionCenter student={student} />
            </div>
          </div>

          {/* Div 2: contains Academic Records and Support (uses contents display on desktop) */}
          <div className="order-2 lg:order-none lg:contents flex flex-col gap-4 lg:gap-3 lg:min-h-0">
            <div className="lg:order-2 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
              {/* Course Records - compact + internally scrollable */}
              <section className="lg:flex lg:flex-col lg:min-h-0 rounded-sm overflow-hidden border border-[#0b3578] lg:border-slate-200 bg-white lg:flex-1">
                <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 lg:py-2 border-b border-[#0b3578] lg:border-slate-200 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold text-[#0b3578] lg:text-slate-500 uppercase tracking-[0.20em]">Academic Records</h2>
                  <Link href="/student/academics" className="text-[9px] font-bold text-[#2563EB] hover:text-blue-700 uppercase tracking-widest">Full Progress</Link>
                </div>

                <div className="bg-[#0b3578]/[0.02] lg:bg-transparent lg:flex-1 lg:min-h-0 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {academicPerformance && academicPerformance.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {academicPerformance.slice(0, 5).map((sub, i) => (
                        (() => {
                          const percent = getAttendancePercent(sub);
                          const tone = getAttendanceTone(percent);
                          const visual = pickSubjectVisual(sub.subject_name, i);
                          const VisualIcon = visual.Icon;

                          return (
                            <div
                              key={i}
                              className="group flex items-center justify-between gap-4 p-3 sm:p-4 transition-all hover:bg-slate-50 lg:hover:bg-transparent lg:cursor-default"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={"h-8 w-8 shrink-0 rounded-sm ring-1 " + visual.ring + " " + visual.bg + " flex items-center justify-center"}>
                                  <VisualIcon className={"h-4 w-4 " + visual.fg} />
                                </div>

                                <div className="min-w-0">
                                  <h4 className="text-[13px] font-bold text-slate-900 leading-tight tracking-tight truncate">
                                    {sub.subject_name}
                                  </h4>
                                  <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mt-0.5 truncate">
                                    {sub.subject_code} • {sub.faculty_name || 'TBA'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="hidden sm:flex flex-col items-end">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Attendance</p>
                                  <div className={"mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 " + tone.border + ' ' + tone.bg}>
                                    <span className={"h-1.5 w-1.5 rounded-full " + tone.dot} aria-hidden="true" />
                                    <span className={"text-[10px] font-bold " + tone.text}>{percent.toFixed(1)}%</span>
                                  </div>
                                </div>

                                <Link
                                  href="/student/academics"
                                  className="flex items-center lg:hidden"
                                >
                                  <span className="hidden sm:inline text-[9px] font-bold text-slate-400 hover:text-[#2563EB] uppercase tracking-widest">
                                    View
                                  </span>
                                  <svg 
                                    className="sm:hidden w-5 h-5 text-[#0b3578]" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              </div>
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 sm:p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.20em]">No curriculum records</div>
                  )}
                </div>
              </section>
            </div>

            {/* Support Card */}
            <section className="order-2 lg:order-3 lg:shrink-0 rounded-sm border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.20em]">Support</p>
              <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
                Contact the departmental clerk during office hours.
              </p>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}