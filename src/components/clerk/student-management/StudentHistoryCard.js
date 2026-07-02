"use client";

import { useState, useMemo, useEffect, useRef } from 'react';

export default function StudentHistoryCard({ _currentClerkId }) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyScope, setHistoryScope] = useState('my'); // 'my' | 'all'
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState('bottom'); // 'bottom' | 'top'
  const DEFAULT_FILTERS = { actionTypes: [], dateRange: 'all' };
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_FILTERS); // staged filters
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS); // actually applied to fetch
  const [historyData, setHistoryData] = useState({ records: [], myCount: 0, allCount: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const triggerRef = useRef(null);
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

  // Fetch records from backend when scope or filters change AND it is expanded
  useEffect(() => {
    if (!isExpanded) return;

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
  }, [requestKey, historyScope, appliedFilters.dateRange, appliedFilters.actionTypes, isExpanded]);

  // Compute popover placement to avoid viewport overflow
  useEffect(() => {
    if (!showFilters) return;
    let mounted = true;
    function compute() {
      const trig = triggerRef.current;
      if (!trig) return;
      const rect = trig.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedHeight = 260; // safe estimate for popover height
      if (spaceBelow < estimatedHeight && spaceAbove > estimatedHeight) {
        if (mounted) setPopoverPosition('top');
      } else {
        if (mounted) setPopoverPosition('bottom');
      }
    }
    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => { mounted = false; window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true); };
  }, [showFilters]);

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
    <div className="border border-gray-300 rounded-md bg-white overflow-hidden transition-all duration-300">
      {/* Header / Toggle */}
      <button 
        type="button"
        className="w-full text-left px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors gap-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Student Entry History</h3>
          <p className="text-sm text-gray-600 mt-1">
            Activity Count: {historyScope === 'my' ? myCount : allCount} {historyData.records.length > 0 && `• Last Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-300 p-4 bg-white">
          
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-gray-50 p-3 rounded-md border border-gray-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                type="button" 
                onClick={() => setHistoryScope('my')} 
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${historyScope === 'my' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
              >
                My Actions
              </button>
              <button 
                type="button" 
                onClick={() => setHistoryScope('all')} 
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${historyScope === 'all' ? 'bg-[#0b3578] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
              >
                System Activity
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto relative">
              <button 
                ref={triggerRef} 
                type="button" 
                onClick={() => setShowFilters(s => !s)} 
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters {appliedFilters.actionTypes.length > 0 ? `(${appliedFilters.actionTypes.length})` : ''}
              </button>

              <button 
                type="button"
                onClick={() => {
                  historyCacheRef.current.delete(requestKey);
                  setIsExpanded(false); 
                  setTimeout(() => setIsExpanded(true), 10);
                }}
                className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-500 hover:text-[#0b3578] transition-colors"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>

              {showFilters && (
                <div className={`${popoverPosition === 'bottom' ? 'absolute right-0 mt-2 top-full' : 'absolute right-0 mb-2 bottom-full'} w-72 bg-white rounded-md shadow-lg border border-gray-300 p-4 z-20`} style={{ minWidth: 280 }}>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Action Type</h4>
                      <div className="flex flex-wrap gap-2">
                        {['ADDED','UPDATED','IMPORTED'].map(t => {
                          const active = historyFilters.actionTypes.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggleActionType(t)}
                              className={
                                "px-3 py-1 text-xs rounded-md transition-colors border " +
                                (active ? 'bg-[#0b3578] border-[#0b3578] text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')
                              }
                            >
                              {t === 'ADDED' ? 'Created' : t.charAt(0) + t.slice(1).toLowerCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Date Range</h4>
                      <div className="flex bg-gray-100 p-1 rounded-md">
                        {[
                          { val: '7', label: '7 Days' },
                          { val: '30', label: '30 Days' },
                          { val: 'all', label: 'All Time' }
                        ].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              const nf = { ...historyFilters, dateRange: opt.val };
                              setHistoryFilters(nf);
                              setAppliedFilters(nf);
                            }}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${historyFilters.dateRange === opt.val ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0b3578]"></div>
                <span className="ml-3 text-sm text-gray-500">Loading history...</span>
              </div>
            )}

            {!loading && filtered.keys.length === 0 && (
              <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
                <p className="text-sm text-gray-500">No activity found for this scope.</p>
              </div>
            )}

            {!loading && filtered.keys.map(k => (
              <div key={k} className="relative pl-4 border-l border-gray-200 ml-2">
                <div className="absolute w-2.5 h-2.5 bg-white border border-[#0b3578] rounded-full -left-[5px] top-1"></div>
                <div className="text-sm font-semibold text-gray-800 mb-3 ml-2">{k}</div>
                
                <div className="space-y-2 ml-2">
                  {filtered.groups[k].map(act => (
                    <div key={act._keyId} className="bg-white p-3 rounded-md border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-[11px] rounded-md border ${badgeClass(act.actionType)}`}>
                          {act.actionType === 'ADDED' ? 'CREATED' : act.actionType}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            {act.rollNo && (
                              <span className="font-mono bg-gray-100 px-1.5 rounded">
                                {act.rollNo}
                              </span>
                            )}
                            <span>
                              {act.actionType === 'IMPORTED' ? `Imported ${act.totalRecords ?? ''} students` : (act.actionType === 'ADDED' ? 'Student Registered' : 'Profile Updated')}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-500 mt-0.5">
                            By: {historyScope === 'all' && act.clerkName ? act.clerkName : 'Me'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 shrink-0">
                        {new Date(act.actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
