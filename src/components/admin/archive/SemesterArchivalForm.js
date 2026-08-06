'use client';

import React, { useState } from 'react';

export default function SemesterArchivalForm({ onJobStarted, onRefreshOverview }) {
  const [branch, setBranch] = useState('CSE');
  const [semester, setSemester] = useState('5');
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [reason, setReason] = useState('End of semester processing & database optimization');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
  const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const academicYears = ['2024-25', '2025-26', '2026-27'];

  const handleSubmit = (e) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const executeArchive = async () => {
    setLoading(true);
    setFeedback(null);
    setConfirmOpen(false);

    try {
      const res = await fetch('/api/admin/archive/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SEMESTER',
          branch,
          semester: Number(semester),
          academic_year: academicYear,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Archival failed');
      }

      setFeedback({
        type: 'success',
        message: `Semester Archival Job #${data.jobId} completed successfully! Archived ${data.affectedRecordsCount} academic records and ${data.affectedMediaCount} media assets in ${data.executionTimeMs}ms.`,
      });

      if (onJobStarted) onJobStarted();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to execute semester archival job.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Semester Archival Engine</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Archive completed academic semester logs (attendance, topics, internal marks, and verified fee receipts) to optimize operational database query speeds.</p>
        </div>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
          Closed Semesters Only
        </span>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg text-xs font-semibold mb-5 flex items-start justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-2 font-bold cursor-pointer hover:opacity-75">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Department / Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b} Engineering</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Academic Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {semesters.map(s => (
                <option key={s} value={s}>Semester S{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {academicYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Archival Reason / Context</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Reason for archiving this semester"
            required
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing Archival...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8zm14 0l-4-4H9L5 8" />
                </svg>
                Run Semester Archival Job
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Confirm Semester Archival</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to archive academic data for <strong className="text-indigo-700">{branch} Semester S{semester} ({academicYear})</strong>? 
              Operational attendance, topics, and marks for this semester will be relocated to the Archive Storage Domain.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeArchive}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors"
              >
                Confirm & Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
