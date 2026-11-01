'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { StaffContext } from '@/context/StaffContext';
import { normalizeEventName, REALTIME_EVENTS } from '@/lib/events/realtime-events';
import {
  getRealtimeStatus,
  subscribeToRealtimeStatus,
  joinRealtimeRoom,
  leaveRealtimeRoom,
  disconnectRealtimeSocket,
  disconnectRealtime,
  subscribeToRealtimeEvents,
  ensureRealtimeConnection
} from '@/lib/realtime/client';

export {
  getRealtimeStatus,
  subscribeToRealtimeStatus,
  joinRealtimeRoom,
  leaveRealtimeRoom,
  disconnectRealtimeSocket,
  disconnectRealtime,
  subscribeToRealtimeEvents
};

/**
 * RealtimeListener Component (Mounted in Root/Context Providers)
 */
export default function RealtimeListener({ onUpdate, enableNotifications = false }) {
  const studentContext = useContext(StudentContext);
  const staffContext = useContext(StaffContext);
  const studentData = studentContext?.studentData;
  const currentStaff = staffContext?.staffData;

  const studentDataRef = useRef(studentData);
  const staffDataRef = useRef(currentStaff);
  const onUpdateRef = useRef(onUpdate);
  const enableNotificationsRef = useRef(enableNotifications);
  const [_status, setStatus] = useState(getRealtimeStatus);

  useEffect(() => {
    studentDataRef.current = studentData;
    staffDataRef.current = currentStaff;
  }, [studentData, currentStaff]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    enableNotificationsRef.current = enableNotifications;
  }, [onUpdate, enableNotifications]);

  const handleNotification = useCallback((event, payload) => {
    const sData = studentDataRef.current;
    const stData = staffDataRef.current;
    const canonical = normalizeEventName(event);

    if (canonical === REALTIME_EVENTS.TIMETABLE_CHANGED) {
      if (sData?.branch === payload.branch || stData?.branch === payload.branch) {
        toast.success('Timetable has been updated!', { id: 'timetable-update' });
      }
    }

    if (canonical === REALTIME_EVENTS.SESSION_STARTED) {
      if (sData?.branch === payload.branch) {
        toast('🚀 New Attendance Session Started!', { icon: '📝', duration: 8000, id: payload.sessionId });
      }
    }

    if (canonical === REALTIME_EVENTS.REQUEST_CREATED || canonical === REALTIME_EVENTS.REQUEST_UPDATED) {
      if (stData && (payload.staffType === stData.role || payload.role === stData.role)) {
        toast(`New student request: ${payload.certificate_type || payload.type || 'Document'}`, { icon: '🔔' });
      }
      if (sData && (payload.student_id === sData.id || payload.roll_no === sData.roll_no)) {
        toast(`Request update: ${payload.certificate_type || payload.type || 'Request processed'}`, { icon: '📄' });
      }
    }

    if (canonical === REALTIME_EVENTS.ADMISSION_CREATED) {
      if (stData?.role === 'admission') {
        toast.success('New student admission draft received', { id: 'new-admission-draft' });
      }
    }

    if (canonical === REALTIME_EVENTS.STAFF_REGISTRATION_CREATED) {
      if (stData?.role === 'admin' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))) {
        toast('New staff registration pending approval', { icon: '👤', id: 'new-staff-reg' });
      }
    }
  }, []);

  const handleNotificationRef = useRef(handleNotification);
  useEffect(() => {
    handleNotificationRef.current = handleNotification;
  }, [handleNotification]);

  useEffect(() => {
    const statusUnsub = subscribeToRealtimeStatus((nextStatus) => setStatus(nextStatus));
    const eventUnsub = subscribeToRealtimeEvents(({ type, payload }) => {
      if (typeof onUpdateRef.current === 'function') onUpdateRef.current({ type, payload });
      if (enableNotificationsRef.current) handleNotificationRef.current(type, payload || {});
    });

    ensureRealtimeConnection();

    return () => {
      statusUnsub();
      eventUnsub();
    };
  }, []);

  return null;
}
