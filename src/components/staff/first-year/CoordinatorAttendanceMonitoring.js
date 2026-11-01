'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileDown, 
  RefreshCw, 
  Search,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const INSTITUTIONAL_BRANCHES = ['ALL', 'CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

export default function CoordinatorAttendanceMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedSem, setSelectedSem] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRiskDrawer, setShowRiskDrawer] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch === 'ALL' ? 'all' : selectedBranch;
      const res = await fetch(`/api/staff/coordinator/academic-monitoring?branch=${branchParam}&semester=${selectedSem}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to load monitoring data');
      }
      const json = await res.json();
      setData(json.data || json);
    } catch (err) {
      toast.error(err.message || 'Error fetching attendance monitoring');
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
  const atRisk = data?.at_risk_students || [];

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
      {/* ─── Control & Filter Bar ──────────────────────────────────────────────── */}
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
            <Clock className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Conducted Sessions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary.total_conducted_sessions ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Across {summary.total_subjects ?? 0} active subjects</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">On Track</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{summary.compliant_subjects ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Consistent class conduction</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center text-rose-600 mb-1">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">No Classes Recorded</span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{summary.no_sessions_subjects ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Action required by faculty</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-amber-600 mb-1">
              <Users className="w-4 h-4 mr-1.5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Condonation Risk</span>
            </div>
            {atRisk.length > 0 && (
              <button
                onClick={() => setShowRiskDrawer(!showRiskDrawer)}
                className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                {showRiskDrawer ? 'Hide' : 'View'}
              </button>
            )}
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.at_risk_students_count ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Students with &lt;75% attendance</p>
        </div>
      </div>

      {/* ─── Condonation Risk Drawer ───────────────────────────────────────────── */}
      {showRiskDrawer && atRisk.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                First-Year Condonation Risk Notice (&lt;75% Attendance)
              </h4>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              {atRisk.length} Student{atRisk.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto bg-white rounded-lg border border-amber-200 divide-y divide-slate-100">
            {atRisk.map((st) => (
              <div key={st.roll_no} className="p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">{st.name}</span>
                  <span className="ml-2 font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {st.roll_no}
                  </span>
                  <span className="ml-2 text-slate-400 font-semibold">{st.branch}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">
                    {st.total_present} / {st.total_sessions} sessions
                  </span>
                  <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-700">
                    {st.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Compliance Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Classroom Conduction & Attendance Register Compliance</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live scheduled-vs-conducted tracking across first-year cohorts. Download complete A4 registers for auditing.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
            Showing {filteredRecords.length} Subjects
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex justify-center items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
            Loading attendance compliance...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No first-year subject records found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Subject & Code</th>
                  <th className="px-4 py-3">Branch & Sem</th>
                  <th className="px-4 py-3">Assigned Faculty</th>
                  <th className="px-4 py-3 text-center">Weekly Slots</th>
                  <th className="px-4 py-3 text-center">Conducted</th>
                  <th className="px-4 py-3">Compliance Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const isNoSessions = r.compliance_status === 'NO_SESSIONS';
                  const isNeedsAttention = r.compliance_status === 'NEEDS_ATTENTION';

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
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {r.weekly_scheduled_slots > 0 ? r.weekly_scheduled_slots : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-slate-900">{r.total_conducted_sessions}</span>
                        {r.last_session_date && (
                          <div className="text-[10px] text-slate-400">Last: {r.last_session_date}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isNoSessions
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isNeedsAttention
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isNoSessions ? 'bg-rose-500' : isNeedsAttention ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {r.compliance_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/staff/faculty/attendance/export/pdf?assignment_id=${r.assignment_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b3578] text-white rounded-lg text-xs font-semibold hover:bg-[#08285a] transition-all shadow-xs"
                          title="Download Official A4 Attendance Register PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Register PDF</span>
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
