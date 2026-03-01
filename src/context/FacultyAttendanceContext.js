'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const FacultyAttendanceContext = createContext(null);

export function FacultyAttendanceProvider({ assignment, children }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [baseStudents, setBaseStudents] = useState([]);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState({});
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
          longitude
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

  const endSession = async () => {
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
  };

  const fetchAttendanceStatus = useCallback(async (forcedDate, forcedSession) => {
    if (!assignment?.id) return;

    const dateToUse = forcedDate || selectedDate;
    const sessionToUse = forcedSession || selectedSession;

    // Even if no date is selected, we want to fetch verified IDs if a session is active
    if (!dateToUse && !activeSession) return;

    const cacheKey = `${dateToUse}-${sessionToUse}`;
    if (!activeSession && dateToUse && attendanceCache[cacheKey]) {
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
      setExistingSessionsForSelectedDate([]);
    }
  }, [selectedDate, selectedSession, fetchAttendanceStatus]);

  // Poll for verified students when a session is active
  useEffect(() => {
    let interval;
    if (activeSession) {
      interval = setInterval(() => {
        // If date is selected, this refreshes the grid + verified IDs
        // If no date, we still need to refresh verified IDs for the list
        fetchAttendanceStatus();
      }, 5000); 
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession, fetchAttendanceStatus]);

  const setAttendanceStatus = useCallback((studentId, status) => {
    setAttendanceStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  const toggleAttendanceStatus = useCallback((studentId) => {
    setAttendanceStatusMap((prev) => {
      const current = prev[studentId] ?? null;
      let next;
      // Cycle: NOT SET -> PRESENT -> ABSENT -> NCC -> MEDICAL -> PRESENT
      if (current === null) next = 'PRESENT';
      else if (current === 'PRESENT') next = 'ABSENT';
      else if (current === 'ABSENT') next = 'NCC';
      else if (current === 'NCC') next = 'MEDICAL';
      else next = 'PRESENT';
      return { ...prev, [studentId]: next };
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

  const handleSaveAttendance = useCallback(async () => {
    if (!assignment?.id) return;
    setSubmitting(true);
    try {
      if (!selectedDate || !dateValidation.isValid) {
        throw new Error('Select a valid WORKING day from the calendar.');
      }

      const attendanceData = baseStudents.map((s) => ({
        student_id: s.id,
        status: attendanceStatusMap[s.id] ?? null,
      }));

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

      toast.success('Attendance saved successfully');

      const cacheKey = `${selectedDate}-${selectedSession}`;
      setAttendanceCache((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });

      await fetchAttendanceStatus();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }, [assignment, baseStudents, attendanceStatusMap, dateValidation.isValid, fetchAttendanceStatus, selectedDate, selectedSession]);

  const handleDeleteAttendance = useCallback(async () => {
    if (!assignment?.id) return;
    if (!selectedDate) {
      toast.error('No date selected');
      return;
    }

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete attendance for Session ${selectedSession} on ${selectedDate}?`)) {
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
    handleSaveAttendance,
    handleDeleteAttendance,
    handleCalendarSelect,
    activeSession,
    startSession,
    endSession,
    verifiedStudentIds,
    fetchAttendanceStatus
  };

  return <FacultyAttendanceContext.Provider value={value}>{children}</FacultyAttendanceContext.Provider>;
}

export function useFacultyAttendance() {
  const context = useContext(FacultyAttendanceContext);
  if (!context) {
    throw new Error('useFacultyAttendance must be used within a FacultyAttendanceProvider');
  }
  return context;
}
