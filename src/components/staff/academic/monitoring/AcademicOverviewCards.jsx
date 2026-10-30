'use client';

import React from 'react';
import {
  Users,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Award,
  BookOpen,
  FileCheck2
} from 'lucide-react';

export default function AcademicOverviewCards({ summary = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  const {
    total_students = 0,
    total_subjects = 0,
    total_conducted_sessions = 0,
    average_attendance_percentage = 0,
    students_below_75 = 0,
    consecutive_absences_count = 0,
    average_cie_marks = null,
    published_marks_count = 0,
    draft_marks_count = 0
  } = summary;

  return (
    <div className="space-y-4">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cohort Size</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0b3578] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total_students}</span>
            <span className="text-xs text-slate-500 font-medium">Students</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>{total_subjects} Subjects Active</span>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Attendance</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              average_attendance_percentage >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{average_attendance_percentage}%</span>
            <span className="text-xs text-slate-500">Cohort Average</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{total_conducted_sessions} Classes Conducted</span>
          </div>
        </div>

        {/* Attendance Attention */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Attention</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              students_below_75 > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{students_below_75}</span>
            <span className="text-xs font-medium text-amber-700">&lt; 75% Threshold</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{consecutive_absences_count > 0 ? `Recent Consecutive Absences: ${consecutive_absences_count}` : 'Students requiring attendance attention'}</span>
          </div>
        </div>

        {/* CIE Evaluation Average */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average CIE</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {average_cie_marks !== null ? `${average_cie_marks}` : 'N/A'}
            </span>
            <span className="text-xs text-slate-500">/ 30 Marks</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Published: <strong>{published_marks_count}</strong> | Draft: <strong>{draft_marks_count}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
