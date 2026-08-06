'use client';

import React from 'react';

export default function ArchiveDashboardStats({ metrics, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs h-32" />
        ))}
      </div>
    );
  }

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const cards = [
    {
      title: 'Students Record Ratio',
      activeLabel: 'Current Active Students',
      activeValue: metrics?.activeStudents ?? 0,
      archivedLabel: 'Archived Alumni Students',
      archivedValue: metrics?.archivedStudents ?? 0,
      color: 'from-blue-600 to-indigo-700',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      title: 'Attendance Records',
      activeLabel: 'Operational Semester Logs',
      activeValue: metrics?.activeAttendance ?? 0,
      archivedLabel: 'Historical Attendance Logs',
      archivedValue: metrics?.archivedAttendance ?? 0,
      color: 'from-emerald-600 to-teal-700',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Marks & Evaluation Data',
      activeLabel: 'Active Mid/Lab Marks',
      activeValue: metrics?.activeMarks ?? 0,
      archivedLabel: 'Archived Marks Records',
      archivedValue: metrics?.archivedMarks ?? 0,
      color: 'from-amber-600 to-orange-700',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      title: 'Archive Storage Footprint',
      activeLabel: 'Completed Archive Jobs',
      activeValue: metrics?.totalCompletedJobs ?? 0,
      archivedLabel: 'Archive Storage Footprint',
      archivedValue: formatSize(metrics?.totalStorageSizeBytes ?? 0),
      color: 'from-purple-600 to-indigo-800',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: (
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{card.title}</span>
              <div className={`p-2 rounded-lg ${card.badgeBg} border`}>
                {card.icon}
              </div>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">{card.activeLabel}</span>
                <span className="text-sm font-bold text-slate-800 font-mono">{card.activeValue}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500">{card.archivedLabel}</span>
                <span className="text-sm font-black text-indigo-900 font-mono">{card.archivedValue}</span>
              </div>
            </div>
          </div>

          {metrics?.lastJobDate && idx === 3 && (
            <p className="text-[10px] text-slate-400 font-mono mt-3 pt-2 border-t border-slate-100">
              Last Job: {new Date(metrics.lastJobDate).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
