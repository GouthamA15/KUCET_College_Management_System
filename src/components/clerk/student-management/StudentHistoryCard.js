"use client";

import { useState, useMemo, useEffect, useRef } from 'react';

export default function StudentHistoryCard({ currentClerkId }) {
  // State
  const [historyScope, setHistoryScope] = useState('my'); // 'my' | 'all'
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState('bottom'); // 'bottom' | 'top'
  const DEFAULT_FILTERS = { actionTypes: [], dateRange: 'all' };
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_FILTERS); // staged filters
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS); // actually applied to fetch
  const triggerRef = useRef(null);

  // Remote state
  const [recordsRaw, setRecordsRaw] = useState([]); // as returned by API
  const [myCount, setMyCount] = useState(0);
  const [allCount, setAllCount] = useState(0);
  const [loading, setLoading] = useState(false);

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
    let isMounted = true;
    async function fetchHistory() {
      setLoading(true);
      setRecordsRaw([]); // clear old records while loading
      try {
        const params = new URLSearchParams();
        params.set('scope', historyScope || 'my');
        // use appliedFilters for actual fetch
        if (appliedFilters.dateRange && appliedFilters.dateRange !== 'all') params.set('dateRange', appliedFilters.dateRange);
        (appliedFilters.actionTypes || []).forEach(t => params.append('actionType', t));

        const res = await fetch(`/api/clerk/student-history?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) {
          console.error('Failed to fetch student history', await res.text());
          if (!isMounted) return;
          setRecordsRaw([]);
          setMyCount(0);
          setAllCount(0);
        } else {
          const json = await res.json();
          console.debug('student-history response', json);
          console.debug('records length', Array.isArray(json.records) ? json.records.length : 0);
          if (!isMounted) return;
          setRecordsRaw(Array.isArray(json.records) ? json.records : []);
          setMyCount(Number(json.myCount) || 0);
          setAllCount(Number(json.allCount) || 0);
        }
      } catch (err) {
        console.error('Error fetching student history', err);
        if (isMounted) {
          setRecordsRaw([]);
          setMyCount(0);
          setAllCount(0);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchHistory();
    return () => { isMounted = false; };
  }, [historyScope, appliedFilters]);

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
  }, [showFilters, triggerRef]);

  // Derived filtered/grouped records from recordsRaw
  const filtered = useMemo(() => {
    // Apply client-side actionType filter if backend didn't (defensive)
    const src = recordsRaw.filter(r => {
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
  }, [recordsRaw, historyScope, appliedFilters, currentClerkId]);

  const toggleActionType = (type) => {
    setHistoryFilters(h => {
      const exists = h.actionTypes.includes(type);
      const newFilters = { ...h, actionTypes: exists ? h.actionTypes.filter(x => x !== type) : [...h.actionTypes, type] };
      setAppliedFilters(newFilters);
      return newFilters;
    });
  };
  // removed explicit Clear/Apply buttons — changes apply immediately

  const badgeClass = (type) => {
    if (type === 'ADDED') return 'bg-green-100 text-green-800';
    if (type === 'UPDATED') return 'bg-blue-100 text-blue-800';
    if (type === 'IMPORTED') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <section className="mt-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Student History</h2>
            <p className="text-sm text-gray-600">Audit timeline of student-related actions.</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistoryScope('my')} className={"px-3 py-1 text-sm rounded-md " + (historyScope === 'my' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700')}>My Activity ({myCount})</button>
            <button type="button" onClick={() => setHistoryScope('all')} className={"px-3 py-1 text-sm rounded-md " + (historyScope === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700')}>All Activity ({allCount})</button>

              <div className="relative">
              <button ref={triggerRef} type="button" onClick={() => setShowFilters(s => !s)} className="px-3 py-1 text-sm rounded-md border bg-white">Filters ⌄</button>
              {showFilters && (
                <div className={(popoverPosition === 'bottom' ? 'absolute right-0 mt-2' : 'absolute right-0 bottom-full mb-2') + ' w-72 bg-white rounded-lg shadow-lg p-4 z-20'} style={{ minWidth: 280 }}>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Action Type</h4>
                      <div className="flex items-center gap-2">
                        {['ADDED','UPDATED','IMPORTED'].map(t => {
                          const active = historyFilters.actionTypes.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggleActionType(t)}
                              className={
                                "px-3 py-1 text-sm rounded-full font-medium transition " +
                                (active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700')
                              }
                            >
                              {t.charAt(0) + t.slice(1).toLowerCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">Date Range</h4>
                      <div className="inline-flex rounded-md bg-gray-100 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nf = { ...historyFilters, dateRange: '7' };
                            setHistoryFilters(nf);
                            setAppliedFilters(nf);
                          }}
                          className={"px-3 py-1 text-sm rounded-md font-medium " + (historyFilters.dateRange === '7' ? 'bg-white text-gray-900 shadow' : 'text-gray-700')}
                        >
                          Last 7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nf = { ...historyFilters, dateRange: '30' };
                            setHistoryFilters(nf);
                            setAppliedFilters(nf);
                          }}
                          className={"px-3 py-1 text-sm rounded-md font-medium " + (historyFilters.dateRange === '30' ? 'bg-white text-gray-900 shadow' : 'text-gray-700')}
                        >
                          Last 30 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nf = { ...historyFilters, dateRange: 'all' };
                            setHistoryFilters(nf);
                            setAppliedFilters(nf);
                          }}
                          className={"px-3 py-1 text-sm rounded-md font-medium " + (historyFilters.dateRange === 'all' ? 'bg-white text-gray-900 shadow' : 'text-gray-700')}
                        >
                          All Time
                        </button>
                      </div>
                    </div>

                    {/* footer buttons removed — filters apply immediately on change */}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="mt-4 space-y-6">
          {loading && (
            <div className="text-sm text-gray-600">Loading activity…</div>
          )}

          {!loading && filtered.keys.length === 0 && (
            <div className="text-sm text-gray-600">No activity to display.</div>
          )}

          {filtered.keys.map(k => (
            <div key={k} className="mt-6">
              <div className="font-semibold text-gray-800 mb-3">{k}</div>
              <div className="border-b border-gray-100 mb-3" />
              <div className="space-y-2">
                {filtered.groups[k].map(act => (
                  <div key={act._keyId} className="px-3 py-2 rounded-md bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <span className={"inline-flex items-center px-2 py-0.5 text-xs font-medium rounded " + badgeClass(act.actionType)}>{act.actionType}</span>
                      <div className="text-sm text-gray-800">
                        {act.rollNo ? <strong className="mr-2">{act.rollNo}</strong> : null}
                        {act.actionType === 'IMPORTED' ? `Imported ${act.totalRecords ?? ''} students` : (act.actionType === 'ADDED' ? 'Student Created' : 'Student Updated')}
                        {historyScope === 'all' && act.clerkName ? (
                          <div className="text-xs text-gray-500 mt-1">By: {act.clerkName}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(act.actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
