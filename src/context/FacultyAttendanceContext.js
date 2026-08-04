'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useOptimistic, useTransition } from 'react';
import toast from 'react-hot-toast';
import RealtimeListener from '@/components/RealtimeListener';
import { getPendingAttendance, savePendingAttendance, deletePendingAttendance } from '@/lib/idb-attendance';

const FacultyAttendanceContext = createContext(null);

export function FacultyAttendanceProvider({ assignment, children }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [baseStudents, setBaseStudents] = useState([]);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState({});
  const [absentCountMap, setAbsentCountMap] = useState({});

  const [optimisticStatusMap, setOptimisticStatusMap] = useOptimistic(
    attendanceStatusMap,
    (currentMap, update) => {
      if (!update) return currentMap;
      if (update.type === 'SET') {
        return { ...currentMap, [update.studentId]: update.status };
      }
      if (update.type === 'SET_ALL') {
        const next = { ...currentMap };
        baseStudents.forEach((s) => {
          next[s.id] = update.status;
        });
        return next;
      }
      return currentMap;
    }
  );

  const [, startTransition] = useTransition();
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
      const url = `/api/clerk/faculty/students?assignment_id=${assignment.id}&base=1`;
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
      const res = await fetch(`/api/clerk/faculty/attendance/session?assignment_id=${assignment.id}`);
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
      return;
    }

    if (dateToUse) setStatusLoading(true);
    try {
      let url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}`;
      if (dateToUse) url += `&date=${encodeURIComponent(dateToUse)}&session=${encodeURIComponent(sessionToUse)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance status');

      const verifiedIds = new Set(data.verified_ids || []);
      setVerifiedStudentIds(verifiedIds);

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
            [cacheKey]: { statusMap, sessions },
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
      let successCount = 0;

      for (const item of toSync) {
        try {
          const res = await fetch('/api/clerk/faculty/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assignment_id: item.assignment_id,
              date: item.date,
              session: item.session,
              attendance_data: item.attendance_data,
            }),
          });

          if (res.ok) {
            await deletePendingAttendance(item.id);
            successCount++;
          } else {
            const data = await res.json();
            throw new Error(data.error || 'Failed to sync record');
          }
        } catch (e) {
          toast.error(`Sync failed for ${item.date} Session ${item.session}: ${e.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully synced ${successCount} attendance records.`);
        await refreshPendingSyncs();
        fetchAttendanceStatus(null, null, true);
      }
    } catch (err) {
      console.error('Global Sync Error:', err);
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

      const res = await fetch('/api/clerk/faculty/attendance/session', {
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
      const res = await fetch(`/api/clerk/faculty/attendance/session?assignment_id=${assignment.id}`, {
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
    startTransition(() => {
      setOptimisticStatusMap({ type: 'SET', studentId, status });
    });
    setAttendanceStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }, [setOptimisticStatusMap, startTransition]);

  const toggleAttendanceStatus = useCallback((studentId) => {
    setAbsentCountMap((prevStages) => {
      const currentStage = prevStages[studentId] || 0;
      let nextStage = currentStage + 1;
      
      if (nextStage > 7) nextStage = 4;

      const stageToStatus = {
        0: null,
        1: 'PRESENT',
        2: 'ABSENT',
        3: 'PRESENT',
        4: 'ABSENT',
        5: 'NCC',
        6: 'MEDICAL',
        7: 'PRESENT'
      };

      const nextStatus = stageToStatus[nextStage];

      startTransition(() => {
        setOptimisticStatusMap({ type: 'SET', studentId, status: nextStatus });
      });

      setAttendanceStatusMap(prevStatus => ({
        ...prevStatus,
        [studentId]: nextStatus
      }));

      return { ...prevStages, [studentId]: nextStage };
    });
  }, [setOptimisticStatusMap, startTransition]);

  const setAllAttendanceStatus = useCallback((status) => {
    startTransition(() => {
      setOptimisticStatusMap({ type: 'SET_ALL', status });
    });
    setAttendanceStatusMap((prev) => {
      const next = { ...prev };
      const nextStages = { ...absentCountMap };
      
      baseStudents.forEach((s) => {
        next[s.id] = status;
        if (status === 'ABSENT') {
          nextStages[s.id] = 2;
        } else if (status === 'PRESENT') {
          nextStages[s.id] = 1;
        } else {
          nextStages[s.id] = 0;
        }
      });
      
      setAbsentCountMap(nextStages);
      return next;
    });
  }, [baseStudents, absentCountMap, setOptimisticStatusMap, startTransition]);

  const handleSaveAttendance = useCallback(async () => {
    if (!assignment?.id) return;
    
    const previousStatusMap = { ...attendanceStatusMap };
    const previousCache = { ...attendanceCache };
    const previousActiveSession = activeSession;

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

      toast.success('Attendance saved (Optimistic)', { id: 'attendance-save' });
      
      if (activeSession) {
        setActiveSession(null);
      }

      const cacheKey = `${selectedDate}-${selectedSession}`;
      setAttendanceCache((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });

      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          session: selectedSession,
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

      toast.success('Attendance synced with server', { id: 'attendance-save' });

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
        initialTopic: ''
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
  }, [assignment, baseStudents, attendanceStatusMap, dateValidation.isValid, fetchAttendanceStatus, selectedDate, selectedSession, activeSession, endSession, attendanceCache, refreshPendingSyncs]);

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
        `/api/clerk/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}&session=${selectedSession}`,
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

      setAbsentCountMap(prev => ({
        ...prev,
        [original_student_id]: 2
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
      setAbsentCountMap({});
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
        setAbsentCountMap({});
        setExistingSessionsForSelectedDate([]);
      }
    };
    fetchStatus();
  }, [selectedDate, selectedSession, fetchAttendanceStatus]);

  // --- DERIVED STATE (useMemo) ---

  const students = useMemo(
    () => baseStudents.map((s) => ({ ...s, status: optimisticStatusMap[s.id] ?? null })),
    [baseStudents, optimisticStatusMap],
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
    toggleAttendanceStatus,
    setAllAttendanceStatus,
    existingSessionsForSelectedDate,
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
