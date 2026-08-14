"use client";

import { useState, useMemo, useEffect, useRef } from 'react';

export default function StudentHistoryCard({ _currentClerkId }) {
  // State
  const [historyScope, setHistoryScope] = useState('my'); // 'my' | 'all'
  const DEFAULT_FILTERS = { actionTypes: [], dateRange: 'all' };
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_FILTERS); // staged filters
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS); // actually applied to fetch
  const [historyData, setHistoryData] = useState({ records: [], myCount: 0, allCount: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const historyCacheRef = useRef(new Map());

  const myCount = historyData.myCount || 0;
  const allCount = historyData.allCount || 0;
  const loading = isLoadingHistory;
  const actionTypesKey = useMemo(() => [...appliedFilters.actionTypes].sort().join(','), [appliedFilters.actionTypes]);
  const requestKey = useMemo(() => `${historyScope}|${appliedFilters.dateRange}|${actionTypesKey}`, [historyScope, appliedFilters.dateRange, actionTypesKey]);

  // Helpers
  const formatDateKey = (iso) => {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Fetch records from backend when scope or filters change
  useEffect(() => {
    const cachedHistory = historyCacheRef.current.get(requestKey);
    if (cachedHistory) {
      setHistoryData(cachedHistory);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const params = new URLSearchParams();
        params.set('scope', historyScope);
        params.set('dateRange', appliedFilters.dateRange);
        appliedFilters.actionTypes.forEach((type) => params.append('actionType', type));

        const res = await fetch(`/api/clerk/student-history?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) return;

        const json = await res.json();
        const nextHistory = {
          records: json.records || [],
          myCount: json.myCount || 0,
          allCount: json.allCount || 0
        };

        historyCacheRef.current.set(requestKey, nextHistory);
        if (isActive) {
          setHistoryData(nextHistory);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Failed to fetch student history', error);
        }
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [requestKey, historyScope, appliedFilters.dateRange, appliedFilters.actionTypes]);

  // Derived filtered/grouped records from recordsRaw
  const filtered = useMemo(() => {
    const raw = historyData.records || [];
    // Apply client-side actionType filter if backend didn't (defensive)
    const src = raw.filter(r => {
      if (appliedFilters.actionTypes.length > 0 && !appliedFilters.actionTypes.includes(String(r.actionType))) return false;
      return true;
    });

    const groups = {};
    src.forEach((r, idx) => {
      const key = formatDateKey(r.actionTime);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...r, _keyId: `${r.actionType}-${r.actionTime}-${r.rollNo || 'imported'}-${idx}` });
    });

    const keys = Object.keys(groups).sort((a, b) => {
      const pa = a.split('-').reverse().join('-');
      const pb = b.split('-').reverse().join('-');
      return pb.localeCompare(pa);
    });

    return { groups, keys };
  }, [historyData.records, appliedFilters.actionTypes]);

  const toggleActionType = (type) => {
    setHistoryFilters(h => {
      const exists = h.actionTypes.includes(type);
      const newFilters = { ...h, actionTypes: exists ? h.actionTypes.filter(x => x !== type) : [...h.actionTypes, type] };
      setAppliedFilters(newFilters);
      return newFilters;
    });
  };

  const badgeClass = (type) => {
    if (type === 'ADDED' || type === 'CREATED') return 'bg-green-100 text-green-800 border-green-200';
    if (type === 'UPDATED') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'IMPORTED') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (type === 'DELETED') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="bg-transparent space-y-4">
      {/* Toolbar / Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-4 rounded-md border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button 
            type="button" 
            onClick={() => setHistoryScope('my')} 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${historyScope === 'my' ? 'bg-[#0b3578] text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
          >
            My Actions
          </button>
          <button 
            type="button" 
            onClick={() => setHistoryScope('all')} 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${historyScope === 'all' ? 'bg-[#0b3578] text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
          >
            System Activity
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Inline Action Type Filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-600 mr-1">Action:</span>
            {['ADDED','UPDATED','IMPORTED'].map(t => {
              const active = historyFilters.actionTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleActionType(t)}
                  className={
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors border " +
                    (active ? 'bg-[#0b3578] border-[#0b3578] text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')
                  }
                >
                  {t === 'ADDED' ? 'Created' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          {/* Inline Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Time:</span>
            <select
              value={historyFilters.dateRange}
              onChange={(e) => {
                const nf = { ...historyFilters, dateRange: e.target.value };
                setHistoryFilters(nf);
                setAppliedFilters(nf);
              }}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-[#0b3578] focus:ring-[#0b3578] py-1 pl-2 pr-8"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button 
            type="button"
            onClick={() => {
              historyCacheRef.current.delete(requestKey);
              setHistoryData({ records: [], myCount: 0, allCount: 0 }); // clear to trigger reload visual
            }}
            className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-500 hover:text-[#0b3578] hover:bg-gray-50 transition-colors shadow-sm ml-auto lg:ml-0"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
         <p className="text-sm text-gray-600">
           Found <strong>{historyScope === 'my' ? myCount : allCount}</strong> activities matching your filters.
         </p>
      </div>

      {/* Timeline */}
      <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm min-h-[300px]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578] mb-4"></div>
            <span className="text-sm font-medium">Fetching history records...</span>
          </div>
        )}

        {!loading && filtered.keys.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-base text-gray-600 font-medium">No activity found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters to see more results.</p>
          </div>
        )}

        {!loading && filtered.keys.map(k => (
          <div key={k} className="relative pl-6 border-l-2 border-gray-100 ml-4 mb-8 last:mb-0">
            <div className="absolute w-3 h-3 bg-white border-2 border-[#0b3578] rounded-full -left-[7.5px] top-1"></div>
            <div className="text-sm font-bold text-gray-700 mb-4 tracking-wide">{k}</div>
            
            <div className="space-y-3">
              {filtered.groups[k].map(act => (
                <div key={act._keyId} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-md border uppercase tracking-wider ${badgeClass(act.actionType)}`}>
                      {act.actionType === 'ADDED' ? 'CREATED' : act.actionType}
                    </div>
                    
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800 font-medium">
                        {act.rollNo && (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
                            {act.rollNo}
                          </span>
                        )}
                        <span>
                          {act.actionType === 'IMPORTED' ? `Imported ${act.totalRecords ?? ''} students` : (act.actionType === 'ADDED' ? 'Registered new student record' : 'Updated student profile')}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        By: <span className="font-medium text-gray-700">{historyScope === 'all' && act.clerkName ? act.clerkName : 'Me'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs font-medium text-gray-400 shrink-0 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(act.actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
