'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import RealtimeListener from '@/components/RealtimeListener';

const FacultyAttendanceContext = createContext(null);

export function FacultyAttendanceProvider({ assignment, children }) {
  // ... (rest of state)

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [baseStudents, setBaseStudents] = useState([]);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState({});
  const [absentCountMap, setAbsentCountMap] = useState({}); // Tracking variable for absent clicks
  const [existingSessionsForSelectedDate, setExistingSessionsForSelectedDate] = useState([]);
  const [dayInfo, setDayInfo] = useState(null);
  const [dateValidation, setDateValidation] = useState({
    isValid: false,
    message: 'Select a WORKING day from the academic calendar.',
  });
  const [loading, setLoading] = useState(true); // base students loading
  const [statusLoading, setStatusLoading] = useState(false); // attendance status loading for grid
  const [submitting, setSubmitting] = useState(false);
  const [attendanceCache, setAttendanceCache] = useState({}); // { `${date}-${session}`: { statusMap, sessions } }
  const [activeSession, setActiveSession] = useState(null);
  const [verifiedStudentIds, setVerifiedStudentIds] = useState(new Set());

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

  const startSession = async () => {
    if (!assignment?.id) return;

    let latitude = null;
    let longitude = null;
    let accuracy = null;

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
          accuracy = pos.coords.accuracy;
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

  // ... rest same ...

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
    } catch (error) {
      toast.error('Failed to end session');
    } finally {
      setSubmitting(false);
    }
  }, [assignment]);

  const fetchAttendanceStatus = useCallback(async (forcedDate, forcedSession, bypassCache = false) => {
    if (!assignment?.id) return;

    const dateToUse = forcedDate || selectedDate;
    const sessionToUse = forcedSession || selectedSession;

    // Even if no date is selected, we want to fetch verified IDs if a session is active
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

        // Auto-set PRESENT for verified students who aren't in the DB yet
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

  // load base students once per assignment
  useEffect(() => {
    setSelectedDate(null);
    setSelectedSession(1);
    setAttendanceStatusMap({});
    setAbsentCountMap({}); // FIX: Reset stage tracker on assignment change
    setExistingSessionsForSelectedDate([]);
    setDayInfo(null);
    setDateValidation({
      isValid: false,
      message: 'Select a WORKING day from the academic calendar.',
    });
    setAttendanceCache({});
    setActiveSession(null);

    fetchBaseStudents();
    fetchActiveSession();
  }, [assignment, fetchBaseStudents, fetchActiveSession]);

  // on date or session change, only fetch attendance status
  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceStatus();
    } else {
      setAttendanceStatusMap({});
      setAbsentCountMap({}); // FIX: Reset stage tracker on date/session change to ensure fresh cycle
      setExistingSessionsForSelectedDate([]);
    }
  }, [selectedDate, selectedSession, fetchAttendanceStatus]);

  const handleManualRefresh = useCallback(() => {
    fetchAttendanceStatus(null, null, true);
  }, [fetchAttendanceStatus]);

  const setAttendanceStatus = useCallback((studentId, status) => {
    setAttendanceStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  const toggleAttendanceStatus = useCallback((studentId) => {
    setAbsentCountMap((prevStages) => {
      const currentStage = prevStages[studentId] || 0;
      let nextStage = currentStage + 1;
      
      // The Cycle: N/A(0) -> P(1) -> A(2) -> P(3) -> A(4) -> NCC(5) -> MED(6) -> P(7)
      // Repeat from second absent (Stage 4)
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

      setAttendanceStatusMap(prevStatus => ({
        ...prevStatus,
        [studentId]: nextStatus
      }));

      return { ...prevStages, [studentId]: nextStage };
    });
  }, []);

  const setAllAttendanceStatus = useCallback((status) => {
    setAttendanceStatusMap((prev) => {
      const next = { ...prev };
      const nextStages = { ...absentCountMap };
      
      baseStudents.forEach((s) => {
        next[s.id] = status;
        // Align stages for bulk actions
        if (status === 'ABSENT') {
          nextStages[s.id] = 2; // Jump to first ABSENT stage
        } else if (status === 'PRESENT') {
          nextStages[s.id] = 1; // Jump to first PRESENT stage
        } else {
          nextStages[s.id] = 0; // Reset to N/A
        }
      });
      
      setAbsentCountMap(nextStages);
      return next;
    });
  }, [baseStudents, absentCountMap]);

  const handleSaveAttendance = useCallback(async () => {
    if (!assignment?.id) return;
    
    // Capture current state for rollback
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

      // Validation: Ensure no students are left as null
      const missing = attendanceData.filter(a => a.status === null);
      if (missing.length > 0) {
        throw new Error(`Please set attendance status for all students. (${missing.length} remaining)`);
      }

      // --- OPTIMISTIC UI START ---
      toast.success('Attendance saved (Optimistic)', { id: 'attendance-save' });
      
      // Optimistically clear active session
      if (activeSession) {
        setActiveSession(null);
      }

      // Optimistically update cache
      const cacheKey = `${selectedDate}-${selectedSession}`;
      setAttendanceCache((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      // --- OPTIMISTIC UI END ---

      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          session: selectedSession,
          attendance_data: attendanceData,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');

      toast.success('Attendance synced with server', { id: 'attendance-save' });

      // If we didn't end the session optimistically (e.g. if it was already null), 
      // or to ensure server state is reflected
      if (previousActiveSession && !activeSession) {
         // Session was already handled optimistically
      } else if (activeSession) {
         await endSession();
      }

      await fetchAttendanceStatus(selectedDate, selectedSession, true);
    } catch (error) {
      // --- ROLLBACK START ---
      console.error('[AttendanceSaveRollback]', error);
      setAttendanceStatusMap(previousStatusMap);
      setAttendanceCache(previousCache);
      setActiveSession(previousActiveSession);
      // --- ROLLBACK END ---
      
      toast.error(error.message, { id: 'attendance-save' });
    } finally {
      setSubmitting(false);
    }
  }, [assignment, baseStudents, attendanceStatusMap, dateValidation.isValid, fetchAttendanceStatus, selectedDate, selectedSession, activeSession, endSession, attendanceCache]);

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

  const students = useMemo(
    () => baseStudents.map((s) => ({ ...s, status: attendanceStatusMap[s.id] ?? null })),
    [baseStudents, attendanceStatusMap],
  );

  const handleRealtimeUpdate = useCallback((data) => {
    if (data.type === 'STUDENT_VERIFIED' && data.payload.assignment_id === assignment.id) {
      console.log('[AttendanceSync] Student verified, refreshing...');
      fetchAttendanceStatus();
    } else if (data.type === 'PROXY_ATTEMPTED' && data.payload.assignment_id === assignment.id) {
      const { attempting_roll_no, original_roll_no, original_student_id } = data.payload;
      
      // 1. Show Formal Government-Style Toaster
      toast.error(
        (t) => (
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

      // 2. Update Local State: Remove from verified and set to ABSENT
      setVerifiedStudentIds(prev => {
        const next = new Set(prev);
        next.delete(original_student_id);
        return next;
      });

      setAttendanceStatusMap(prev => ({
        ...prev,
        [original_student_id]: 'ABSENT'
      }));

      // 3. Update Absent Count Map to align with the stage cycle
      setAbsentCountMap(prev => ({
        ...prev,
        [original_student_id]: 2 // Stage 2 is the first 'ABSENT' stage
      }));
    }
  }, [assignment.id, fetchAttendanceStatus]);

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
    fetchAttendanceStatus
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
