'use client';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
  Copy, 
  Search, 
  Calendar, 
  User, 
  BookOpen, 
  AlertTriangle, 
  X, 
  Loader2, 
  ArrowRight,
  Filter
} from 'lucide-react';
import { formatDate } from '@/lib/date';

/**
 * ReuseAttendanceModal
 * Modal allowing faculty to select an eligible previous session from the same cohort
 * and copy its attendance statuses into the current sheet as an independent record.
 */
export default function ReuseAttendanceModal({
  isOpen,
  onClose,
  assignment,
  selectedDate,
  _selectedSession,
  currentStatusMap = {},
  onAttendanceReused,
}) {
  const [loading, setLoading] = useState(false);
  const [fetchingSessionData, setFetchingSessionData] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [cohort, setCohort] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateOnly, setFilterDateOnly] = useState(false);

  // Confirmation state when destination already has marks
  const [pendingSessionData, setPendingSessionData] = useState(null);

  // Count how many students in destination are already marked
  const alreadyMarkedCount = useMemo(() => {
    return Object.values(currentStatusMap || {}).filter(Boolean).length;
  }, [currentStatusMap]);

  // Load eligible sessions when modal opens
  useEffect(() => {
    if (!isOpen || !assignment?.id) return;

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setSearchQuery('');
    setPendingSessionData(null);

    const dateParam = filterDateOnly && selectedDate ? `&date=${encodeURIComponent(selectedDate)}` : '';
    const url = `/api/staff/faculty/attendance/reuse/eligible-sessions?assignment_id=${assignment.id}${dateParam}`;

    fetch(url)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!isMounted) return;
        if (!ok) {
          throw new Error(data.error || 'Failed to load eligible sessions');
        }
        setSessions(data.sessions || []);
        setCohort(data.cohort || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Unable to fetch eligible sessions');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, assignment?.id, selectedDate, filterDateOnly]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !fetchingSessionData) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, fetchingSessionData, onClose]);

  if (!isOpen) return null;

  // Filter sessions by search query
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.subject_name?.toLowerCase().includes(q) ||
      s.subject_code?.toLowerCase().includes(q) ||
      s.faculty_name?.toLowerCase().includes(q) ||
      s.attendance_date?.includes(q) ||
      `session ${s.session_number}`.toLowerCase().includes(q)
    );
  });

  // User clicked "Reuse This Session"
  const handleSelectSession = async (sourceSession) => {
    if (!assignment?.id || fetchingSessionData) return;

    setFetchingSessionData(true);
    try {
      const url = `/api/staff/faculty/attendance/reuse/session-data?destination_assignment_id=${assignment.id}&source_session_id=${sourceSession.session_id}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load session attendance data');
      }

      // If destination already has marked students, prompt confirmation step
      if (alreadyMarkedCount > 0) {
        setPendingSessionData(data);
        return;
      }

      // Otherwise apply directly
      onAttendanceReused(data);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to fetch attendance data.');
    } finally {
      setFetchingSessionData(false);
    }
  };

  // User confirms overwriting existing marks
  const handleConfirmOverwrite = () => {
    if (!pendingSessionData) return;
    onAttendanceReused(pendingSessionData);
    setPendingSessionData(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !fetchingSessionData) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reuse-modal-title"
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative transform transition-all my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={fetchingSessionData}
            className="absolute top-4 right-4 p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shrink-0">
              <Copy className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 block">
                Cross-Session Attendance Sync
              </span>
              <h2 id="reuse-modal-title" className="text-lg font-bold text-white leading-snug">
                Reuse Previous Session Attendance
              </h2>
            </div>
          </div>

          {cohort && (
            <div className="mt-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 text-[11px] text-blue-100 border border-white/10">
              <span className="font-semibold uppercase">Cohort:</span>
              <span>{cohort.branch} • Semester {cohort.course_semester} • {cohort.academic_year}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Overwrite Confirmation View */}
          {pendingSessionData ? (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <h4 className="font-bold text-amber-950 mb-1">Confirm Status Replacement</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Your current attendance register already has{' '}
                    <span className="font-bold">{alreadyMarkedCount} students</span> marked.
                    Reusing attendance from{' '}
                    <span className="font-bold">{pendingSessionData.source_session.subject_name}</span>{' '}
                    will prefill the sheet with{' '}
                    <span className="font-bold">{pendingSessionData.matched_count}</span> copied records.
                  </p>
                </div>
              </div>

              {pendingSessionData.missing_students?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900">
                  <span className="font-bold block mb-1">Lateral-Entry / Unrecorded Students Notice:</span>
                  <p className="text-blue-800 leading-relaxed">
                    {pendingSessionData.missing_students.length} student(s) in your class roster were not recorded in the source session. They will be defaulted to <span className="font-bold">Absent</span> for your review:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {pendingSessionData.missing_students.map((st) => (
                      <span key={st.id} className="font-mono text-[10px] font-bold bg-white text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                        {st.roll_no}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 italic">
                Note: This creates an independent draft in your register. The source session will not be modified or linked.
              </p>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingSessionData(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 uppercase tracking-wide cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverwrite}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  Replace & Prefill Statuses
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Search & Filter Toolbar */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by subject, code, faculty or date…"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDateOnly(!filterDateOnly)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors shrink-0 cursor-pointer ${
                      filterDateOnly
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    title={filterDateOnly ? 'Show all dates' : `Filter to ${formatDate(selectedDate)} only`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>{filterDateOnly ? `Date: ${formatDate(selectedDate)}` : 'All Dates'}</span>
                  </button>
                )}
              </div>

              {/* Instructions Callout */}
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Select a previously conducted lecture or lab for this cohort. Attendance statuses will be prefilled into your current register as an <span className="font-bold text-slate-800">independent record</span> that you can edit and save separately.
                </p>
              </div>

              {/* Content States */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">Finding eligible previous sessions…</span>
                </div>
              ) : error ? (
                <div className="py-8 text-center">
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-xs font-semibold mb-3">
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterDateOnly(filterDateOnly)}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700 mb-1">No Eligible Sessions Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? 'No sessions matched your search criteria.'
                      : filterDateOnly
                      ? `No other faculty recorded attendance for this cohort on ${formatDate(selectedDate)}. Try toggling "All Dates".`
                      : 'No previously recorded attendance sessions exist for this student cohort yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSessions.map((s) => (
                    <div
                      key={s.session_id}
                      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-3.5 transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                            {s.subject_name}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {s.subject_code}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.subject_type.includes('Lab')
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {s.subject_type}
                          </span>
                        </div>

                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.faculty_name}</span>
                          </div>
                          <div className="inline-flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDate(s.attendance_date)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1">
                            <span className="font-bold text-slate-700">Session S{s.session_number}</span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px]">
                            <span className="text-emerald-700 font-bold">{s.present_count} P</span>
                            <span>/</span>
                            <span className="text-slate-600 font-bold">{s.total_students} Total</span>
                          </div>
                        </div>

                        {s.topic_covered && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate">
                            Topic: {s.topic_covered}
                          </p>
                        )}
                      </div>

                      <div className="sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectSession(s)}
                          disabled={fetchingSessionData}
                          className="w-full sm:w-auto px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {fetchingSessionData ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Reuse Statuses</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>{filteredSessions.length} session(s) available</span>
          <button
            type="button"
            onClick={onClose}
            disabled={fetchingSessionData}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors uppercase text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
