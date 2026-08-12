'use client';

import React from 'react';
import Link from 'next/link';

const QUICK_LINKS = [
  {
    title: 'Apply Certificate',
    description: 'Request Bonafide, Custodian or TC',
    route: '/student/requests/certificates',
    icon: (
      <svg className="w-5 h-5 text-[#0b3578]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    badgeBg: 'bg-blue-50 group-hover:bg-blue-100',
    badgeBorder: 'border-blue-100',
  },
  {
    title: 'Attendance & Marks',
    description: 'Track subject attendance and grades',
    route: '/student/academics',
    icon: (
      <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    badgeBg: 'bg-emerald-50 group-hover:bg-emerald-100',
    badgeBorder: 'border-emerald-100',
  },
  {
    title: 'Class Timetable',
    description: 'Period schedules & faculty assignments',
    route: '/student/timetable',
    icon: (
      <svg className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    badgeBg: 'bg-indigo-50 group-hover:bg-indigo-100',
    badgeBorder: 'border-indigo-100',
  },
  {
    title: 'Fee Payment & Receipts',
    description: 'Pay dues & view transaction history',
    route: '/student/finances',
    icon: (
      <svg className="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    badgeBg: 'bg-amber-50 group-hover:bg-amber-100',
    badgeBorder: 'border-amber-100',
  },
  {
    title: 'Academic Profile',
    description: 'Personal info, roll number & branch',
    route: '/student/profile',
    icon: (
      <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    badgeBg: 'bg-slate-100 group-hover:bg-slate-200',
    badgeBorder: 'border-slate-200',
  },
  {
    title: 'Edit Profile',
    description: 'Update phone, address & photo',
    route: '/student/settings/edit-profile',
    icon: (
      <svg className="w-5 h-5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    badgeBg: 'bg-purple-50 group-hover:bg-purple-100',
    badgeBorder: 'border-purple-100',
  },
  {
    title: 'Security Center',
    description: 'Password, verification & device sessions',
    route: '/student/settings/security',
    icon: (
      <svg className="w-5 h-5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    badgeBg: 'bg-rose-50 group-hover:bg-rose-100',
    badgeBorder: 'border-rose-100',
  },
  {
    title: 'ID Card Request',
    description: 'Apply for official student ID card',
    route: '/student/requests/id-card',
    icon: (
      <svg className="w-5 h-5 text-[#0b3578]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
      </svg>
    ),
    badgeBg: 'bg-sky-50 group-hover:bg-sky-100',
    badgeBorder: 'border-sky-100',
  },
];

export default function StudentQuickLinks() {
  return (
    <section className="rounded-sm border border-slate-200 bg-white overflow-hidden shadow-xs">
      <div className="bg-[#0b3578]/5 px-4 py-2.5 lg:py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0b3578]" aria-hidden="true" />
          <h2 className="text-xs font-bold text-[#0b3578] uppercase tracking-[0.18em]">
            Student Quick Services
          </h2>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
          Direct Navigation
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {/* Layout Requirement: Desktop: 4 columns, Tablet: 3 columns, Mobile: 2 columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.route}
              href={link.route}
              className="group relative flex flex-col justify-between p-3 sm:p-3.5 bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-[#0b3578]/40 rounded-md transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#0b3578] focus:ring-offset-1"
              aria-label={`${link.title}: ${link.description}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`p-2 rounded-lg border ${link.badgeBorder} ${link.badgeBg} transition-colors shrink-0`}>
                  {link.icon}
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-[#0b3578] group-hover:translate-x-0.5 transition-all shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-[#0b3578] transition-colors leading-tight tracking-tight">
                  {link.title}
                </h3>
                <p className="text-[10.5px] font-normal text-slate-500 mt-1 leading-snug line-clamp-2">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
