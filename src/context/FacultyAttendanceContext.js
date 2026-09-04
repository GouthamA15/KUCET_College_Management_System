'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import RealtimeListener from '@/components/RealtimeListener';
import { getPendingAttendance, savePendingAttendance, deletePendingAttendance } from '@/lib/idb-attendance';

const FacultyAttendanceContext = createContext(null);

export function FacultyAttendanceProvider({ assignment, children }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [baseStudents, setBaseStudents] = useState([]);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState({});
  const [currentTopicCovered, setCurrentTopicCovered] = useState('');

  const [existingSessionsForSelectedDate, setExistingSessionsForSelectedDate] = useState([]);
  const [dayInfo, setDayInfo] = useState(null);
  const [dateValidation, setDateValidation] = useState({
    isValid: false,
    message: 'Select a WORKING day from the academic calendar.',
  });
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceCache, setAttendanceCache] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [verifiedStudentIds, setVerifiedStudentIds] = useState(new Set());
  const [pendingSyncs, setPendingSyncs] = useState([]);
  const [topicModalSession, setTopicModalSession] = useState(null);

  // --- ACTIONS (useCallback) ---

  const fetchBaseStudents = useCallback(async () => {
    if (!assignment?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `/api/staff/faculty/students?assignment_id=${assignment.id}&base=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');

      const base = (data.data || []).map((s) => ({
        id: s.id,
        roll_no: s.roll_no,
        name: s.name,
        pfp: s.pfp || null,
      }));
      setBaseStudents(base);
      setAttendanceStatusMap({});
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment]);

  const fetchActiveSession = useCallback(async () => {
    if (!assignment?.id) return;
    try {
      const res = await fetch(`/api/staff/faculty/attendance/session?assignment_id=${assignment.id}`);
      const json = await res.json();
      if (res.ok && json.active) {
        setActiveSession(json.session);
      } else {
        setActiveSession(null);
      }
    } catch (e) {
      console.error('Failed to fetch active session:', e);
    }
  }, [assignment]);

  const fetchAttendanceStatus = useCallback(async (forcedDate, forcedSession, bypassCache = false) => {
    if (!assignment?.id) return;

    const dateToUse = forcedDate || selectedDate;
    const sessionToUse = forcedSession || selectedSession;

    if (!dateToUse && !activeSession) return;

    const cacheKey = `${dateToUse}-${sessionToUse}`;
    if (!bypassCache && !activeSession && dateToUse && attendanceCache[cacheKey]) {
      setAttendanceStatusMap(attendanceCache[cacheKey].statusMap || {});
      setExistingSessionsForSelectedDate(attendanceCache[cacheKey].sessions || []);
      setCurrentTopicCovered(attendanceCache[cacheKey].topicCovered || '');
      return;
    }

    if (dateToUse) setStatusLoading(true);
    try {
      let url = `/api/staff/faculty/attendance/status?assignment_id=${assignment.id}`;
      if (dateToUse) url += `&date=${encodeURIComponent(dateToUse)}&session=${encodeURIComponent(sessionToUse)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance status');

      const verifiedIds = new Set(data.verified_ids || []);
      setVerifiedStudentIds(verifiedIds);

      const topicFromApi = data.topic_covered || '';
      setCurrentTopicCovered(topicFromApi);

      if (dateToUse) {
        const statusMap = (data.data || []).reduce((acc, r) => {
          acc[r.student_id] = r.status;
          return acc;
        }, {});

        verifiedIds.forEach(id => {
          if (!statusMap[id]) statusMap[id] = 'PRESENT';
        });

        const sessions = data.sessions || [];
        setAttendanceStatusMap(statusMap);
        setExistingSessionsForSelectedDate(sessions);

        if (!activeSession) {
          setAttendanceCache((prev) => ({
            ...prev,
            [cacheKey]: { statusMap, sessions, topicCovered: topicFromApi },
          }));
        }
      }
    } catch (error) {
      if (dateToUse) toast.error(error.message);
    } finally {
      setStatusLoading(false);
    }
  }, [assignment, selectedDate, selectedSession, attendanceCache, activeSession]);

  const refreshPendingSyncs = useCallback(async () => {
    try {
      const pending = await getPendingAttendance();
      setPendingSyncs(pending || []);
    } catch (e) {
      console.error('Failed to fetch pending syncs:', e);
    }
  }, []);

  const syncOfflineAttendance = useCallback(async (idToSync = null) => {
    try {
      const allPending = await getPendingAttendance();
      const toSync = idToSync ? allPending.filter((p) => p.id === idToSync) : allPending;

      if (toSync.length === 0) return;

      setSubmitting(true);

      const res = await fetch('/api/staff/faculty/attendance/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: toSync }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to perform bulk offline sync');

      if (data.synced_ids && data.synced_ids.length > 0) {
        for (const syncedId of data.synced_ids) {
          await deletePendingAttendance(syncedId);
        }
        toast.success(`Successfully synced ${data.synced_ids.length} offline attendance records.`);
        await refreshPendingSyncs();
        fetchAttendanceStatus(null, null, true);
      }
    } catch (err) {
      console.error('Bulk Offline Sync Error:', err);
      toast.error(err.message || 'Failed to sync offline attendance records.');
    } finally {
      setSubmitting(false);
    }
  }, [refreshPendingSyncs, fetchAttendanceStatus]);

  const startSession = async () => {
    if (!assignment?.id) return;

    let latitude = null;
    let longitude = null;
    let _accuracy = null;

    try {
      setSubmitting(true);

      if (navigator.geolocation) {
        toast.loading('Requesting location access...', { id: 'geo-loading' });
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 0
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
          _accuracy = pos.coords.accuracy;
          toast.dismiss('geo-loading');
        } catch (geoErr) {
          toast.dismiss('geo-loading');
          console.warn('Geolocation failed, falling back to PIN-only:', geoErr);
          const proceed = window.confirm('GPS is blocked or unavailable (requires HTTPS on mobile). Start session with PIN-only security?');
          if (!proceed) throw new Error('Session cancelled by user.');
        }
      } else {
        const proceed = window.confirm('Your browser doesn\'t support GPS. Start session with PIN-only security?');
        if (!proceed) return;
      }

      toast.loading('Creating secure session...', { id: 'session-loading' });

      const res = await fetch('/api/staff/faculty/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          latitude,
          longitude,
          attendance_date: selectedDate,
          session_number: selectedSession
        }),
      });
      
      const json = await res.json();
      toast.dismiss('session-loading');

      if (!res.ok) throw new Error(json.error || 'Failed to start session');
      
      setActiveSession(json.session);
      toast.success('Attendance session started!');
    } catch (error) {
      toast.dismiss('geo-loading');
      toast.dismiss('session-loading');
      console.error('Start Session Error:', error);
      
      let msg = error.message;
      if (error.code === 1) msg = 'Location permission denied. Please enable location in your browser settings.';
      if (error.code === 2) msg = 'Location unavailable.';
      if (error.code === 3) msg = 'Location request timed out. Please try again.';
      
      toast.error(msg || 'Geolocation is required to start a session.');
    } finally {
      setSubmitting(false);
    }
  };

  const endSession = useCallback(async () => {
    if (!assignment?.id) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/staff/faculty/attendance/session?assignment_id=${assignment.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActiveSession(null);
        toast.success('Session ended.');
      }
    } catch (_error) {
      toast.error('Failed to end session');
    } finally {
      setSubmitting(false);
    }
  }, [assignment]);

  const handleManualRefresh = useCallback(() => {
    fetchAttendanceStatus(null, null, true);
  }, [fetchAttendanceStatus]);

  const setAttendanceStatus = useCallback((studentId, status) => {
    setAttendanceStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  const setBatchAttendanceStatus = useCallback((statusMapOrFn) => {
    setAttendanceStatusMap((prev) => {
      const updates = typeof statusMapOrFn === 'function' ? statusMapOrFn(prev) : statusMapOrFn;
      return { ...prev, ...updates };
    });
  }, []);

  const toggleAttendanceStatus = useCallback((studentId) => {
    setAttendanceStatusMap((prev) => {
      const current = prev[studentId] || null;
      let nextStatus = 'PRESENT';
      if (current === null) nextStatus = 'PRESENT';
      else if (current === 'PRESENT') nextStatus = 'ABSENT';
      else if (current === 'ABSENT') nextStatus = 'NCC';
      else if (current === 'NCC') nextStatus = 'MEDICAL';
      else if (current === 'MEDICAL') nextStatus = 'PRESENT';
      
      return {
        ...prev,
        [studentId]: nextStatus
      };
    });
  }, []);

  const setAllAttendanceStatus = useCallback((status) => {
    setAttendanceStatusMap((prev) => {
      const next = { ...prev };
      baseStudents.forEach((s) => {
        next[s.id] = status;
      });
      return next;
    });
  }, [baseStudents]);

  const handleSaveAttendance = useCallback(async (explicitTopic = undefined) => {
    if (!assignment?.id) return;
    
    const previousStatusMap = { ...attendanceStatusMap };
    const previousCache = { ...attendanceCache };
    const previousActiveSession = activeSession;
    const topicToSave = explicitTopic !== undefined ? explicitTopic : (currentTopicCovered || '');

    setSubmitting(true);
    try {
      if (!selectedDate || !dateValidation.isValid) {
        throw new Error('Select a valid WORKING day from the calendar.');
      }

      const attendanceData = baseStudents.map((s) => ({
        student_id: s.id,
        status: attendanceStatusMap[s.id] ?? null,
      }));

      const missing = attendanceData.filter(a => a.status === null);
      if (missing.length > 0) {
        throw new Error(`Please set attendance status for all students. (${missing.length} remaining)`);
      }

      toast.success('Saving attendance...', { id: 'attendance-save' });
      
      if (activeSession) {
        setActiveSession(null);
      }

      const cacheKey = `${selectedDate}-${selectedSession}`;
      setAttendanceCache((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });

      const res = await fetch('/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          session: selectedSession,
          topic_covered: topicToSave.trim() || null,
          attendance_data: attendanceData,
        }),
      }).catch(async (err) => {
        if (!navigator.onLine || err.message.includes('Failed to fetch')) {
          const payload = {
            assignment_id: assignment.id,
            subject_name: assignment.subject_name,
            date: selectedDate,
            session: selectedSession,
            attendance_data: attendanceData,
          };
          await savePendingAttendance(payload);
          await refreshPendingSyncs();
          throw new Error('OFFLINE_SAVED');
        }
        throw err;
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');

      toast.success('Attendance saved successfully', { id: 'attendance-save' });

      if (data.topic_covered) {
        setCurrentTopicCovered(data.topic_covered);
      }

      if (previousActiveSession && !activeSession) {
         // Session already handled
      } else if (activeSession) {
         await endSession();
      }

      await fetchAttendanceStatus(selectedDate, selectedSession, true);
      setTopicModalSession({
        assignmentId: assignment.id,
        date: selectedDate,
        session: selectedSession,
        initialTopic: data.topic_covered || topicToSave || ''
      });
    } catch (error) {
      if (error.message === 'OFFLINE_SAVED') {
        toast.success('Offline: Attendance saved to device. It will sync automatically when you are back online.', { duration: 5000 });
        setActiveSession(null);
        setSubmitting(false);
        return;
      }

      console.error('[AttendanceSaveRollback]', error);
      setAttendanceStatusMap(previousStatusMap);
      setAttendanceCache(previousCache);
      setActiveSession(previousActiveSession);
      
      toast.error(error.message, { id: 'attendance-save' });
    } finally {
      setSubmitting(false);
    }
  }, [assignment, baseStudents, attendanceStatusMap, dateValidation.isValid, fetchAttendanceStatus, selectedDate, selectedSession, activeSession, endSession, attendanceCache, refreshPendingSyncs, currentTopicCovered]);

  const handleDeleteAttendance = useCallback(async () => {
    if (!assignment?.id) return;
    if (!selectedDate) {
      toast.error('No date selected');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete attendance for Session ${selectedSession} on ${selectedDate}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/staff/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}&session=${selectedSession}`,
        {
          method: 'DELETE',
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attendance');

      toast.success('Attendance deleted successfully');

      const cacheKey = `${selectedDate}-${selectedSession}`;
      setAttendanceCache((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });

      await fetchAttendanceStatus();
      setSelectedSession(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }, [assignment, fetchAttendanceStatus, selectedDate, selectedSession]);

  const handleCalendarSelect = useCallback((dateStr, info) => {
    setSelectedDate(dateStr);
    if (info) {
      setDayInfo(info);
      if (info.day_type === 'WORKING') {
        setDateValidation({ isValid: true, message: null });
      } else {
        setDateValidation({
          isValid: false,
          message: `Attendance cannot be marked. Reason: ${info.day_type}`,
        });
      }
    } else {
      setDayInfo(null);
      setDateValidation({
        isValid: false,
        message: 'Select a WORKING day from the academic calendar.',
      });
    }
  }, []);

  const handleRealtimeUpdate = useCallback((data) => {
    if (data.type === 'STUDENT_VERIFIED' && data.payload.assignment_id === assignment.id) {
      console.info('[AttendanceSync] Student verified, refreshing...');
      fetchAttendanceStatus();
    } else if (data.type === 'PROXY_ATTEMPTED' && data.payload.assignment_id === assignment.id) {
      const { attempting_roll_no, original_roll_no, original_student_id } = data.payload;
      
      toast.error(
        (_t) => (
          <div className="flex flex-col gap-1 border-l-4 border-red-600 pl-2">
            <span className="font-black text-xs uppercase tracking-widest text-red-800">Security Breach Detected</span>
            <div className="text-[11px] font-bold text-gray-700 leading-tight">
              Student <span className="text-red-600">{original_roll_no}</span> attempted proxy for <span className="text-blue-700">{attempting_roll_no}</span>.
            </div>
            <div className="text-[9px] font-bold text-gray-500 uppercase mt-1">
              Action: {original_roll_no} marked as ABSENT.
            </div>
          </div>
        ),
        { 
          duration: 10000, 
          id: `proxy-${original_roll_no}`,
          style: {
            borderRadius: '0px',
            border: '1px solid #fee2e2',
            background: '#fff',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px'
          }
        }
      );

      setVerifiedStudentIds(prev => {
        const next = new Set(prev);
        next.delete(original_student_id);
        return next;
      });

      setAttendanceStatusMap(prev => ({
        ...prev,
        [original_student_id]: 'ABSENT'
      }));
    }
  }, [assignment.id, fetchAttendanceStatus]);

  // --- SYNCS (useEffect) ---

  useEffect(() => {
    const initSync = async () => {
      await refreshPendingSyncs();
    };
    initSync();

    const handleOnline = () => {
      toast.success('Back online! Checking for pending attendance...', { icon: '🔄' });
      syncOfflineAttendance();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshPendingSyncs, syncOfflineAttendance]);

  useEffect(() => {
    const init = async () => {
      setSelectedDate(null);
      setSelectedSession(1);
      setAttendanceStatusMap({});
      setCurrentTopicCovered('');
      setExistingSessionsForSelectedDate([]);
      setDayInfo(null);
      setDateValidation({
        isValid: false,
        message: 'Select a WORKING day from the academic calendar.',
      });
      setAttendanceCache({});
      setActiveSession(null);

      await fetchBaseStudents();
      await fetchActiveSession();
    };
    init();
  }, [assignment, fetchBaseStudents, fetchActiveSession]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (selectedDate) {
        await fetchAttendanceStatus();
      } else {
        setAttendanceStatusMap({});
        setCurrentTopicCovered('');
        setExistingSessionsForSelectedDate([]);
      }
    };
    fetchStatus();
  }, [selectedDate, selectedSession, fetchAttendanceStatus]);

  // --- DERIVED STATE (useMemo) ---

  const students = useMemo(
    () => baseStudents.map((s) => ({ ...s, status: attendanceStatusMap[s.id] ?? null })),
    [baseStudents, attendanceStatusMap],
  );

  const value = {
    assignment,
    selectedDate,
    setSelectedDate,
    selectedSession,
    setSelectedSession,
    baseStudents,
    attendanceStatusMap,
    setAttendanceStatus,
    setBatchAttendanceStatus,
    toggleAttendanceStatus,
    setAllAttendanceStatus,
    existingSessionsForSelectedDate,
    currentTopicCovered,
    setCurrentTopicCovered,
    dayInfo,
    dateValidation,
    loading,
    statusLoading,
    submitting,
    students,
    handleManualRefresh,
    handleSaveAttendance,
    handleDeleteAttendance,
    handleCalendarSelect,
    activeSession,
    startSession,
    endSession,
    verifiedStudentIds,
    setVerifiedStudentIds,
    fetchAttendanceStatus,
    pendingSyncs,
    syncOfflineAttendance,
    topicModalSession,
    setTopicModalSession
  };

  return (
    <FacultyAttendanceContext.Provider value={value}>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      {children}
    </FacultyAttendanceContext.Provider>
  );
}

export function useFacultyAttendance() {
  const context = useContext(FacultyAttendanceContext);
  if (!context) {
    throw new Error('useFacultyAttendance must be used within a FacultyAttendanceProvider');
  }
  return context;
}
