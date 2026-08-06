'use client';

import React from 'react';

export default function ArchiveAuditLogs({ logs = [], loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-40 bg-slate-100 rounded w-full" />
      </div>
    );
  }

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Archive Execution Audit Logs</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Immutable audit trail of every semester archival, alumni transition, media movement, and restoration event.</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-xs">
          No archive execution jobs recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Job Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Target / Scope</th>
                <th className="py-2.5 px-3 text-right">Affected Records</th>
                <th className="py-2.5 px-3 text-right">Media Assets</th>
                <th className="py-2.5 px-3 text-right">Storage Size</th>
                <th className="py-2.5 px-3">Executed By</th>
                <th className="py-2.5 px-3">Execution Time</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {logs.map((log) => (
                <tr key={log.id || log.job_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{log.job_id}</td>
                  <td className="py-2.5 px-3 font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      log.archive_type === 'SEMESTER' ? 'bg-blue-100 text-blue-800' :
                      log.archive_type === 'ALUMNI' ? 'bg-purple-100 text-purple-800' :
                      log.archive_type === 'RESTORE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {log.archive_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {log.branch ? `${log.branch} ` : ''}
                    {log.semester ? `S${log.semester} ` : ''}
                    {log.academic_year || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{log.affected_records_count || 0}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{log.affected_media_count || 0}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatSize(log.storage_size_bytes)}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{log.archived_by}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{log.execution_time_ms}ms</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      log.status === 'RESTORED' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
