'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import ArchiveDashboardStats from '@/components/admin/archive/ArchiveDashboardStats';
import SemesterArchivalForm from '@/components/admin/archive/SemesterArchivalForm';
import AlumniArchivalPanel from '@/components/admin/archive/AlumniArchivalPanel';
import ArchiveSearchRestorePanel from '@/components/admin/archive/ArchiveSearchRestorePanel';
import RetentionPoliciesManager from '@/components/admin/archive/RetentionPoliciesManager';
import ArchiveAuditLogs from '@/components/admin/archive/ArchiveAuditLogs';

function ArchiveCenterContent() {
  const [activeTab, setActiveTab] = useState('SEMESTER');
  const [overview, setOverview] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [overviewRes, historyRes] = await Promise.all([
        fetch('/api/admin/archive'),
        fetch('/api/admin/archive/history?limit=50')
      ]);
      const overviewData = await overviewRes.json();
      const historyData = await historyRes.json();

      if (overviewRes.ok) setOverview(overviewData.data || overviewData);
      if (historyRes.ok) setHistoryLogs(historyData.data?.logs || historyData.logs || []);
    } catch (err) {
      console.error('Failed to load archive data:', err);
    } finally {
      setLoadingOverview(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      await refreshData();
    }
    if (!ignore) {
      init();
    }
    return () => { ignore = true; };
  }, [refreshData]);

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight leading-tight">
              Academic Archive Management Center
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium leading-snug">
              Production-grade institutional data lifecycle, semester archival, alumni record preservation, and restoration engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Stats
            </button>
          </div>
        </div>

        {/* Dashboard Executive Stats */}
        <ArchiveDashboardStats metrics={overview?.metrics} loading={loadingOverview} />

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-px mb-6 scrollbar-none">
          {[
            { id: 'SEMESTER', label: 'Semester Archival', icon: 'M5 8h14M5 8a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8zm14 0l-4-4H9L5 8' },
            { id: 'ALUMNI', label: 'Alumni Registry Archive', icon: 'M12 14l9-5-9-5-9 5 9 5z' },
            { id: 'SEARCH', label: 'Search & Restore', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            { id: 'POLICIES', label: 'Retention Rules', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            { id: 'AUDIT', label: 'Execution Audit Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        <div className="animate-fadeIn">
          {activeTab === 'SEMESTER' && (
            <SemesterArchivalForm
              onJobStarted={refreshData}
              onRefreshOverview={refreshData}
            />
          )}

          {activeTab === 'ALUMNI' && (
            <AlumniArchivalPanel
              onJobStarted={refreshData}
              onRefreshOverview={refreshData}
            />
          )}

          {activeTab === 'SEARCH' && (
            <ArchiveSearchRestorePanel
              onRestoreCompleted={refreshData}
              onRefreshOverview={refreshData}
            />
          )}

          {activeTab === 'POLICIES' && (
            <RetentionPoliciesManager
              initialPolicies={overview?.policies || []}
              onPoliciesUpdated={refreshData}
            />
          )}

          {activeTab === 'AUDIT' && (
            <ArchiveAuditLogs
              logs={historyLogs}
              loading={loadingHistory}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminArchiveCenterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full"></div></div>}>
      <ArchiveCenterContent />
    </Suspense>
  );
}
