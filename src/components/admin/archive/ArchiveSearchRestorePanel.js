'use client';

import React, { useState } from 'react';

export default function ArchiveSearchRestorePanel({ onRestoreCompleted, onRefreshOverview }) {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/archive/search?q=${encodeURIComponent(query.trim())}&entity=${entityType}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.data || data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Archive search failed' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewStudent = async (student) => {
    try {
      const res = await fetch('/api/admin/archive/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PREVIEW',
          type: 'STUDENT',
          archive_student_id: student.id,
          roll_no: student.roll_no,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreviewItem(data.data || data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleExecuteRestoreStudent = async (archiveStudentId) => {
    setRestoring(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/archive/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESTORE_STUDENT',
          archive_student_id: archiveStudentId,
          reason: 'Restored via Admin Archive Center portal',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restoration failed');

      setFeedback({
        type: 'success',
        message: data.message || `Student successfully restored from Archive to operational database.`,
      });

      setPreviewItem(null);
      handleSearch(); // Refresh search list
      if (onRestoreCompleted) onRestoreCompleted();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Student restoration failed' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Archive Search & Restoration Portal</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Locate historical student profiles, attendance records, marks, and payment receipts. Preview and safely restore records to operational status without manual SQL.</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg text-xs font-semibold mb-5 flex items-start justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-2 font-bold cursor-pointer hover:opacity-75">✕</button>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Roll No, Student Name, Branch, Batch, Academic Year, or UTR..."
            className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="STUDENTS">Archived Students</option>
            <option value="ATTENDANCE">Attendance Logs</option>
            <option value="MARKS">Marks Records</option>
            <option value="PAYMENTS">Payment Receipts</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Archive
            </>
          )}
        </button>
      </form>

      {/* Results View */}
      {results && (
        <div className="space-y-6 animate-fadeIn">
          {/* Archived Students Results */}
          {results.students && results.students.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Archived Alumni Students ({results.students.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Branch & Batch</th>
                      <th className="py-2.5 px-3">Archived Date</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {results.students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-100/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{st.roll_no}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{st.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{st.branch} ({st.batch})</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{new Date(st.archived_at).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handlePreviewStudent(st)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-200 transition-all cursor-pointer"
                          >
                            Preview & Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Archived Attendance Results */}
          {results.attendance && results.attendance.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Archived Attendance Records ({results.attendance.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Sem & Year</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {results.attendance.map((att) => (
                      <tr key={att.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{att.roll_no}</td>
                        <td className="py-2.5 px-3 text-slate-700">{att.subject_code || 'CS301'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{att.branch} S{att.semester} ({att.academic_year})</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{att.date}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Archived Payments Results */}
          {results.payments && results.payments.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                Archived Fee Payment Transactions ({results.payments.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">UTR Reference</th>
                      <th className="py-2.5 px-3">Academic Year</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Proof Asset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {results.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{p.roll_no}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-900">{p.transaction_ref_no || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.academic_year}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">₹{p.amount}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 truncate max-w-xs">{p.proof_url || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Student Restoration Preview Modal */}
      {previewItem && previewItem.student && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Archived Student Profile Preview</h3>
              <button type="button" onClick={() => setPreviewItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Student Name:</span>
                  <span className="font-bold text-slate-900">{previewItem.student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Roll Number:</span>
                  <span className="font-mono font-bold text-blue-900">{previewItem.student.roll_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Department & Batch:</span>
                  <span className="font-semibold text-slate-800">{previewItem.student.branch} ({previewItem.student.batch})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Archived Date:</span>
                  <span className="font-mono text-slate-600">{new Date(previewItem.student.archived_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-1.5">
                <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px]">Associated Historical Records Found:</span>
                <ul className="list-disc list-inside text-indigo-800 font-medium space-y-0.5">
                  <li>{previewItem.counts?.attendance || 0} Archived Attendance Logs</li>
                  <li>{previewItem.counts?.marks || 0} Archived Evaluation Marks Records</li>
                  <li>{previewItem.counts?.payments || 0} Archived Fee Receipts</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => handleExecuteRestoreStudent(previewItem.student.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {restoring ? 'Restoring Student...' : 'Confirm & Restore Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
