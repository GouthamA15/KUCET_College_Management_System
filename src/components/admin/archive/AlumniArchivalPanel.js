'use client';

import React, { useState } from 'react';

export default function AlumniArchivalPanel({ onJobStarted, onRefreshOverview }) {
  const [graduationYear, setGraduationYear] = useState('2026');
  const [branch, setBranch] = useState('CSE');
  const [reason, setReason] = useState('Course completion & Alumni registry transition');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const branches = ['ALL', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];

  const executeAlumniArchive = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/archive/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ALUMNI',
          graduation_year: graduationYear,
          branch: branch === 'ALL' ? null : branch,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Alumni archival failed');
      }

      setFeedback({
        type: 'success',
        message: data.message || `Alumni Archival Job #${data.jobId} completed. Moved ${data.affectedStudentsCount} graduated student profiles and ${data.affectedMediaCount} profile/signature media assets to the Alumni Archive.`,
      });

      if (onJobStarted) onJobStarted();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to execute alumni graduation archival.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Alumni & Student Lifecycle Archival</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Relocate graduated student profiles, personal details, academic backgrounds, photos, and signatures into the Alumni Archive without losing historical records.</p>
        </div>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
          Graduated Alumni Only
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

      <form onSubmit={executeAlumniArchive} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Graduation Batch Year</label>
            <input
              type="text"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="e.g. 2026"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Target Department</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b === 'ALL' ? 'All Departments' : `${b} Engineering`}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Archival Context / Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Archiving Alumni...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
                Archive Graduated Alumni Batch
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
