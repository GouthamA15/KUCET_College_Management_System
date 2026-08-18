'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { safeJsonParse } from '@/lib/json-utils';

export default function AuditLogsClient() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [filters, setFilters] = useState({
    action: '',
    userType: '',
    targetId: ''
  });
  const [expandedLog, setExpandedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      });

      const res = await fetch(`/api/admin/audit-logs?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error(error);
      toast.error('Could not load audit logs');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, filters]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchLogs();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchLogs]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setOffset(0);
  };

  const formatPayload = (payload) => {
    if (!payload) return 'N/A';
    const parsed = safeJsonParse(payload, payload);
    return typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed, null, 2) : String(parsed);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0b3578] tracking-tight">AUDIT TRAILS</h1>
          <p className="text-slate-500 text-sm font-medium">Monitor system activities and data modifications</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{total.toLocaleString()}</div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider text-right">Total Logs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Action</label>
            <input
              type="text"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              placeholder="e.g. UPDATE_MARKS"
              className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">User Type</label>
            <select
              name="userType"
              value={filters.userType}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 transition-all cursor-pointer bg-white"
            >
              <option value="">All Types</option>
              <option value="admin">Admin</option>
              <option value="clerk">Clerk</option>
              <option value="student">Student</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Target ID</label>
            <input
              type="text"
              name="targetId"
              value={filters.targetId}
              onChange={handleFilterChange}
              placeholder="Search by Target ID"
              className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 transition-all"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                setFilters({ action: '', userType: '', targetId: '' });
                setOffset(0);
              }}
              className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all uppercase tracking-wider cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-40">Timestamp</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-32">User Type</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-48">Action</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Target</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-32 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-12 text-center text-slate-400 italic text-sm">
                      Loading audit trails...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-12 text-center text-slate-400 italic text-sm">
                      No audit logs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${expandedLog === log.id ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.user_type === 'admin' ? 'bg-purple-100 text-purple-700' :
                            log.user_type === 'clerk' ? 'bg-blue-100 text-blue-700' :
                            log.user_type === 'student' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.user_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-600 font-medium">
                              {log.target_type || 'N/A'}: <span className="text-slate-900 font-bold">{log.target_id || 'N/A'}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium italic">
                              IP: {log.ip_address}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="text-[#0b3578] hover:underline text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                          >
                            {expandedLog === log.id ? 'Hide' : 'View Data'}
                          </button>
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr className="bg-slate-50">
                          <td colSpan="5" className="px-4 py-4 border-t border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Before Change</h4>
                                <pre className="p-3 bg-white border border-slate-200 rounded text-[10px] font-mono overflow-auto max-h-60 text-slate-600">
                                  {formatPayload(log.payload_before)}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-[#0b3578]">After Change</h4>
                                <pre className="p-3 bg-white border border-slate-200 rounded text-[10px] font-mono overflow-auto max-h-60 text-slate-900 font-bold">
                                  {formatPayload(log.payload_after)}
                                </pre>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200/50">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">User Agent</h4>
                              <p className="text-[10px] text-slate-500 italic mt-1">{log.user_agent}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50/50">
            {loading ? (
              <div className="py-12 text-center text-slate-400 italic text-sm">
                Loading audit trails...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-sm">
                No audit logs found matching your criteria.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <div className="flex flex-col gap-1">
                      <span className={`w-fit px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        log.user_type === 'admin' ? 'bg-purple-100 text-purple-700' :
                        log.user_type === 'clerk' ? 'bg-blue-100 text-blue-700' :
                        log.user_type === 'student' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.user_type}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {log.action}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 text-right">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-600 font-medium">
                      {log.target_type || 'N/A'}: <span className="text-slate-900 font-bold">{log.target_id || 'N/A'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium italic mt-1">
                      IP: {log.ip_address}
                    </span>
                  </div>

                  <button 
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    className="w-full mt-2 py-2 text-[#0b3578] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    {expandedLog === log.id ? 'Hide Details' : 'View Details'}
                  </button>

                  {expandedLog === log.id && (
                    <div className="mt-2 pt-3 border-t border-slate-200 space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Before Change</h4>
                        <pre className="p-2 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono overflow-auto max-h-40 text-slate-600">
                          {formatPayload(log.payload_before)}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-[#0b3578]">After Change</h4>
                        <pre className="p-2 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono overflow-auto max-h-40 text-slate-900 font-bold">
                          {formatPayload(log.payload_after)}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">User Agent</h4>
                        <p className="text-[9px] text-slate-500 italic break-all">{log.user_agent}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all rounded shadow-xs cursor-pointer"
            >
              Prev
            </button>
            <button 
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all rounded shadow-xs cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
