'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Calendar, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  FileDown, 
  RefreshCw, 
  Search,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const INSTITUTIONAL_BRANCHES = ['ALL', 'CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

export default function CoordinatorMarksMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedSem, setSelectedSem] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch === 'ALL' ? 'all' : selectedBranch;
      const res = await fetch(`/api/staff/coordinator/academic-monitoring?branch=${branchParam}&semester=${selectedSem}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to load marks monitoring data');
      }
      const json = await res.json();
      setData(json.data || json);
    } catch (err) {
      toast.error(err.message || 'Error fetching marks monitoring');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedSem]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchData]);

  const records = data?.records || [];
  const summary = data?.summary || {};

  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.subject_name?.toLowerCase().includes(q) ||
      r.subject_code?.toLowerCase().includes(q) ||
      r.faculty_name?.toLowerCase().includes(q) ||
      r.branch?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Filter Bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            >
              {INSTITUTIONAL_BRANCHES.map(b => (
                <option key={b} value={b}>{b === 'ALL' ? 'All 7 Branches' : b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Semester:</span>
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            >
              <option value="all">Sem 1 & 2 (All First-Year)</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search subject or faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg w-52 focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Subjects</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary.total_subjects ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Semesters 1 and 2</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Published & Locked</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{summary.marks_published_count ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Official locked records</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-amber-600 mb-1">
            <Clock className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Draft / In Progress</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.marks_draft_count ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Unlocked evaluation entries</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-slate-500 mb-1">
            <AlertCircle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Not Entered</span>
          </div>
          <p className="text-2xl font-bold text-slate-600">{summary.marks_pending_count ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Pending evaluation entry</p>
        </div>
      </div>

      {/* ─── Marks Monitoring Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">First-Year Examination Marks & Evaluation Oversight</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect draft and published evaluation reports across all 7 departments with clear status indicators.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
            Showing {filteredRecords.length} Subjects
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex justify-center items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
            Loading examination marks...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No first-year subject marks records found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Subject & Code</th>
                  <th className="px-4 py-3">Branch & Sem</th>
                  <th className="px-4 py-3">Assigned Faculty</th>
                  <th className="px-4 py-3 text-center">Marks Entered</th>
                  <th className="px-4 py-3">Evaluation Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const isPublished = r.marks_status === 'PUBLISHED';
                  const isDraft = r.marks_status === 'DRAFT';

                  return (
                    <tr key={r.assignment_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{r.subject_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{r.subject_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {r.branch} • Sem {r.course_semester}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.faculty_name}</div>
                        {r.faculty_email && <div className="text-[11px] text-slate-400">{r.faculty_email}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-slate-800">{r.marks_entered_count}</span>
                        {r.marks_entered_count > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {r.marks_published_count} pub / {r.marks_draft_count} draft
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isDraft
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}>
                          {isPublished ? (
                            <Lock className="w-3 h-3 text-emerald-700" />
                          ) : isDraft ? (
                            <Unlock className="w-3 h-3 text-amber-700" />
                          ) : (
                            <Clock className="w-3 h-3 text-slate-500" />
                          )}
                          {isPublished
                            ? 'PUBLISHED / LOCKED'
                            : isDraft
                            ? 'DRAFT / UNLOCKED'
                            : 'NOT ENTERED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/staff/faculty/marks/export/pdf?assignment_id=${r.assignment_id}&view=overview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b3578] text-white rounded-lg text-xs font-semibold hover:bg-[#08285a] transition-all shadow-xs"
                          title="Download Official A4 CIE Evaluation Report PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Evaluation PDF</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
