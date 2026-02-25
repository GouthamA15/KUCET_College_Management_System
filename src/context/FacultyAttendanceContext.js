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

  const fetchAttendanceStatus = useCallback(async () => {
    if (!assignment?.id || !selectedDate) return;

    const cacheKey = `${selectedDate}-${selectedSession}`;
    const cached = attendanceCache[cacheKey];
    if (cached) {
      setAttendanceStatusMap(cached.statusMap || {});
      setExistingSessionsForSelectedDate(cached.sessions || []);
      return;
    }

    setStatusLoading(true);
    try {
      const url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}&date=${encodeURIComponent(
        selectedDate,
      )}&session=${encodeURIComponent(selectedSession)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance status');

      const statusMap = (data.data || []).reduce((acc, r) => {
        acc[r.student_id] = r.status;
        return acc;
      }, {});

      const sessions = data.sessions || [];

      setAttendanceStatusMap(statusMap);
      setExistingSessionsForSelectedDate(sessions);

      setAttendanceCache((prev) => ({
        ...prev,
        [cacheKey]: { statusMap, sessions },
      }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStatusLoading(false);
    }
  }, [assignment, selectedDate, selectedSession, attendanceCache]);

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

    fetchBaseStudents();
  }, [assignment, fetchBaseStudents]);

  // on date or session change, only fetch attendance status
  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceStatus();
    } else {
      setAttendanceStatusMap({});
      setExistingSessionsForSelectedDate([]);
    }
  }, [selectedDate, selectedSession, fetchAttendanceStatus]);

  const setAttendanceStatus = useCallback((studentId, status) => {
    setAttendanceStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  const toggleAttendanceStatus = useCallback((studentId) => {
    setAttendanceStatusMap((prev) => {
      const current = prev[studentId] ?? null;
      let next;
      if (current === null) next = 'PRESENT';
      else if (current === 'PRESENT') next = 'ABSENT';
      else next = 'PRESENT';
      return { ...prev, [studentId]: next };
    });
  }, []);

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
