'use client';

import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentAcademicDetailDrawer({
  studentId,
  branch,
  semester,
  academicYear,
  isOpen,
  onClose
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'subjects'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [prevId, setPrevId] = useState(null);

  if (studentId !== prevId) {
    setPrevId(studentId);
    setData(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!isOpen || !studentId) {
      return;
    }

    let isSubscribed = true;

    async function fetchStudentDetails() {
      try {
        const queryParams = new URLSearchParams({
          branch: branch || '',
          semester: String(semester || ''),
          academic_year: academicYear || ''
        });

        const res = await fetch(`/api/staff/academic-monitoring/students/${studentId}?${queryParams.toString()}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch student academic details');
        }

        const json = await res.json();
        if (isSubscribed) {
          setData(json.data);
        }
      } catch (err) {
        if (isSubscribed) {
          toast.error(err.message || 'Error loading student details');
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    fetchStudentDetails();

    return () => {
      isSubscribed = false;
    };
  }, [studentId, branch, semester, academicYear, isOpen]);

  if (!isOpen) return null;

  const student = data?.student || {};
  const summary = data?.summary || {};
  const subjectCards = data?.subject_cards || [];
  const attendanceHistory = data?.attendance_history || [];

  // Filter attendance history
  const filteredHistory = attendanceHistory.filter(item => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (subjectFilter !== 'ALL' && item.subject_code !== subjectFilter) return false;
    return true;
  });

  const uniqueSubjectCodes = [...new Set(attendanceHistory.map(h => h.subject_code))];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-sm">
              {student.name ? student.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{student.name || 'Student Profile'}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold">
                  {student.roll_no}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.branch} • Semester {student.semester} ({student.academic_year})
                {student.admission_date && ` • Admitted: ${student.admission_date}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading academic records...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Overall Attendance</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <span className={`text-xl font-bold ${
                    summary.overall_attendance_pct < 75 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {summary.overall_attendance_pct}%
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Sessions Attended</span>
                <div className="mt-1 font-mono text-xl font-bold text-slate-800">
                  {summary.total_attended} <span className="text-xs text-slate-400 font-normal">/ {summary.total_conducted}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Absences</span>
                <div className="mt-1 font-mono text-xl font-bold text-rose-600">
                  {summary.total_absent}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-b-2 border-[#0b3578] text-[#0b3578]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Session Attendance History ({attendanceHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subjects')}
                className={`pb-2.5 transition-colors cursor-pointer ${
                  activeTab === 'subjects'
                    ? 'border-b-2 border-[#0b3578] text-[#0b3578]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Subject Evaluation & CIE ({subjectCards.length})
              </button>
            </div>

            {/* Tab 1: Chronological Attendance History */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Filters Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Subject:</span>
                      <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="ALL">All Subjects</option>
                        {uniqueSubjectCodes.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Status:</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="NCC">NCC</option>
                        <option value="MEDICAL">Medical</option>
                      </select>
                    </div>
                  </div>

                  <span className="text-slate-400 font-mono text-[11px]">
                    Showing {filteredHistory.length} of {attendanceHistory.length}
                  </span>
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">No session attendance records match your filter.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-2 text-center">Period</th>
                          <th className="py-2 px-3">Subject</th>
                          <th className="py-2 px-3">Topic Covered</th>
                          <th className="py-2 px-3">Faculty</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredHistory.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{item.date}</td>
                            <td className="py-2 px-2 text-center font-mono text-slate-500">P{item.session_number}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800">{item.subject_code}</span>
                              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{item.subject_name}</div>
                            </td>
                            <td className="py-2 px-3 max-w-[200px]">
                              {item.topic_covered === 'Topic not recorded' ? (
                                <span className="text-slate-400 italic text-[11px]">Topic not recorded</span>
                              ) : (
                                <span className="text-slate-700 text-[11px] line-clamp-2">{item.topic_covered}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-[110px]">
                              {item.faculty_name}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                item.status === 'ABSENT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                item.status === 'NCC' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Subject Cards & CIE Breakdown */}
            {activeTab === 'subjects' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subjectCards.map(sub => (
                    <div key={sub.subject_code} className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#0b3578] uppercase">{sub.subject_code}</span>
                          <h4 className="text-xs font-semibold text-slate-900 leading-snug">{sub.subject_name}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{sub.faculty_names?.join(', ') || 'Faculty Assigned'}</p>
                        </div>
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-200/80 font-medium text-slate-700 whitespace-nowrap">
                          {sub.is_lab ? 'Laboratory' : (sub.pattern || 'Theory')}
                        </span>
                      </div>

                      {/* Attendance Stat */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Attendance:</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className={`font-bold ${sub.attendance.percentage < 75 ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {sub.attendance.percentage}%
                          </span>
                          <span className="text-[10px] text-slate-400">({sub.attendance.attended}/{sub.attendance.conducted})</span>
                        </div>
                      </div>

                      {/* Marks Stat */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">CIE Total:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {sub.marks.total_marks !== null ? `${sub.marks.total_marks}/30` : 'Not Entered'}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                              sub.marks.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sub.marks.status_label}
                            </span>
                          </div>
                        </div>

                        {/* Breakdown Pills */}
                        {sub.is_lab ? (
                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-[10px] font-mono text-center">
                            <div>Exec: <strong>{sub.marks.components.execution ?? '—'}</strong></div>
                            <div>Theory: <strong>{sub.marks.components.theory ?? '—'}</strong></div>
                            <div>Record: <strong>{sub.marks.components.record ?? '—'}</strong></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-[10px] font-mono text-center">
                            <div>Mid 1: <strong>{sub.marks.components.mid1 ?? '—'}</strong></div>
                            <div>Mid 2: <strong>{sub.marks.components.mid2 ?? '—'}</strong></div>
                            <div>Asgn: <strong>{sub.marks.components.assignment ?? '—'}</strong></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
