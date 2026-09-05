'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useProfileActivity from '@/hooks/student/useProfileActivity';
import useActivityDismissal from '@/hooks/student/useActivityDismissal';
import { useStudent } from '@/context/StudentContext';
import toast from 'react-hot-toast';

const periodTimes = {
  1: { start: '09:30', end: '10:20' },
  2: { start: '10:20', end: '11:10' },
  3: { start: '11:20', end: '12:10' },
  4: { start: '12:10', end: '13:00' },
  5: { start: '14:00', end: '14:50' },
  6: { start: '14:50', end: '15:40' },
  7: { start: '15:40', end: '16:30' },
};

export default function DashboardActionCenter({ student }) {
  const activity = useProfileActivity();
  const { academicPerformance } = useStudent();
  const {
    latestRequest,
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen,
  } = activity;

  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [pinByAssignment, setPinByAssignment] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [statusByAssignment, setStatusByAssignment] = useState({});
  const [deviceId, setDeviceId] = useState(null);
  const [activeActivity, setActiveActivity] = useState(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/student/current-activity');
      if (res.status === 401 || res.status === 403) return;
      const data = await res.json();
      if (res.ok && data.active) {
        setActiveActivity(data);
      } else {
        setActiveActivity(null);
      }
    } catch { }
  }, []);

  const fetchAttendanceSessions = useCallback(async () => {
    try {
      const assignmentIds = (academicPerformance || []).map((s) => s.assignment_id).filter(Boolean);
      if (!assignmentIds.length) {
        setAttendanceSessions([]);
        return;
      }
      const res = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds.join(',')}`);
      if (res.status === 401 || res.status === 403) return;
      
      const json = await res.json();
      if (res.ok) {
        setAttendanceSessions(json.data || []);
      }
    } catch { }
  }, [academicPerformance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActivity();
     
    fetchAttendanceSessions();
  }, [fetchActivity, fetchAttendanceSessions]);

  useEffect(() => {
    const channel = new BroadcastChannel('kucet_sse_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data) {
        if (data.type === 'TIMETABLE_CHANGED') fetchActivity();
        else if (data.type === 'SESSION_STARTED' || data.type === 'SESSION_ENDED') fetchAttendanceSessions();
      }
    };
    return () => channel.close();
  }, [fetchActivity, fetchAttendanceSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const existing = localStorage.getItem('kucet_device_uuid');
        if (existing) {
          setDeviceId(existing);
          return;
        }
        if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
          const fallback = 'kucet_device_no_crypto';
          localStorage.setItem('kucet_device_uuid', fallback);
          setDeviceId(fallback);
          return;
        }
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const created = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kucet_device_uuid', created);
        setDeviceId(created);
      } catch { }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleChangePin = (assignmentId, value) => {
    const numeric = value.replace(/\D/g, '').slice(0, 4);
    setPinByAssignment(prev => ({ ...prev, [assignmentId]: numeric }));
    setStatusByAssignment(prev => {
      if (!prev[assignmentId]) return prev;
      const { [assignmentId]: _discard, ...rest } = prev;
      return rest;
    });
  };

  const handleVerify = async (session) => {
    const assignmentId = session.assignment_id;
    const pin = pinByAssignment[assignmentId] || '';
    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN shown on faculty screen');
      return;
    }
    setSubmittingId(assignmentId);
    setStatusByAssignment((prev) => {
      const { [assignmentId]: _discard, ...rest } = prev;
      return rest;
    });
    try {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("GPS requires HTTPS on mobile. Please host on Render or use a laptop on 'localhost'.", { duration: 6000 });
        setSubmittingId(null);
        return;
      }
      const resolvedDeviceId = deviceId || localStorage.getItem('kucet_device_uuid');
      if (!resolvedDeviceId) {
        toast.error('Device ID not ready. Please retry.');
        setSubmittingId(null);
        return;
      }
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy > 100) {
        toast.error(`Location accuracy is too low (${Math.round(accuracy)}m). Please move near a window or outdoors for better GPS reception.`);
        setSubmittingId(null);
        return;
      }
      const res = await fetch('/api/student/attendance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          session_id: session.session_id,
          pin,
          latitude,
          longitude,
          accuracy,
          device_id: resolvedDeviceId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification failed');
      
      toast.success(json.message || 'Attendance successfully marked.');
      setAttendanceSessions((prev) => prev.filter((s) => s.assignment_id !== assignmentId));
      
      const channel = new BroadcastChannel('kucet_sse_sync');
      channel.postMessage({ type: 'SESSION_ENDED' });
      channel.close();
    } catch (err) {
      let msg = err.message || 'Verification failed';
      if (err.code === 1) msg = 'Location access denied. Please enable GPS.';
      if (err.code === 3) msg = 'Location request timed out. Please retry.';
      toast.error(msg);
      setStatusByAssignment((prev) => ({
        ...prev,
        [assignmentId]: { tone: 'error', message: msg }
      }));
    } finally {
      setSubmittingId(null);
    }
  };

  const isScholarshipEligible = student?.fee_reimbursement === 'YES' || student?.fee_reimbursement === 'GOV';
  
  const dismissals = {
    received: useActivityDismissal('scholarship_received'),
    thumb: useActivityDismissal(`thumb_${scholarshipThumbUpdate?.application_no || 'gen'}`),
    hardcopy: useActivityDismissal(`hardcopy_${scholarshipHardcopyPending?.application_no || 'gen'}`),
    open: useActivityDismissal(`schol_open_${scholarshipApplicationsOpen?.academic_year || 'gen'}`),
    cert: useActivityDismissal(`cert_update_${latestRequest?.request_id || 'gen'}`)
  };

  const showSecurityWarning = !!student && (!student.email || !student.is_email_verified || !student.password_hash);
  
  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }
    return String(dateStr);
  };

  const hasAttendanceSessions = attendanceSessions.length > 0;
  
  const activeAlerts = [
    ...(showSecurityWarning ? [{
      id: 'security',
      type: 'critical',
      icon: '⚠️',
      title: 'Account Security Required',
      desc: (!student.email ? 'Email not added.' : !student.is_email_verified ? 'Email verification pending.' : 'Password not set.') + ' Complete setup to access all portal features.',
      action: { label: 'Secure Account', href: '/student/settings/security' },
      dismissible: false
    }] : []),
    ...(hasAttendanceSessions ? attendanceSessions.map(session => ({
      id: `attendance_${session.assignment_id}`,
      type: 'action',
      icon: '🔑',
      title: 'Attendance Verification',
      desc: `${session.subject_name} (Faculty: ${session.faculty_name || 'Faculty'})`,
      customRender: () => {
        const assignmentId = session.assignment_id;
        const pin = pinByAssignment[assignmentId] || '';
        const status = statusByAssignment[assignmentId];
        return (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN"
              value={pin}
              onChange={(e) => handleChangePin(assignmentId, e.target.value)}
              className="w-16 rounded-sm border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold tracking-widest text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => handleVerify(session)}
              disabled={submittingId === assignmentId || pin.length !== 4}
              className="px-3 py-1 bg-[#0b3578] text-white text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-blue-700 disabled:opacity-65 transition cursor-pointer"
            >
              {submittingId === assignmentId ? '...' : 'Verify'}
            </button>
            {status?.tone === 'error' && status?.message && (
              <span className="text-[10px] font-bold text-rose-600 ml-2">{status.message}</span>
            )}
          </div>
        );
      },
      dismissible: false
    })) : []),
    ...(activeActivity ? [{
      id: 'class_active',
      type: 'info',
      icon: '📚',
      title: `Current Class: ${activeActivity.activity.subject_name}`,
      desc: `Room: ${activeActivity.activity.room_no || 'TBD'} • Period ${activeActivity.period} (${activeActivity.period ? `${periodTimes[activeActivity.period]?.start || ''} - ${periodTimes[activeActivity.period]?.end || ''}` : ''})`,
      action: { label: 'View Timetable', href: '/student/timetable' },
      dismissible: false
    }] : []),
    ...(isScholarshipEligible && scholarshipHardcopyPending?.active && !dismissals.hardcopy.dismissed ? [{
      id: 'hardcopy',
      type: 'warning',
      icon: '📄',
      title: 'Submit Scholarship Hard Copies',
      desc: `Submit documents at scholarship office. Application No: ${scholarshipHardcopyPending.application_no || 'N/A'}`,
      dismissible: true,
      dismissFn: dismissals.hardcopy.dismiss,
      closing: dismissals.hardcopy.closing
    }] : []),
    ...(isScholarshipEligible && scholarshipThumbUpdate?.active && !dismissals.thumb.dismissed ? [{
      id: 'thumb',
      type: 'warning',
      icon: '🔔',
      title: 'Thumb Verification Required',
      desc: `Biometric verification required. Visit a Mee-Seva center (App No: ${scholarshipThumbUpdate.application_no || 'N/A'}).`,
      dismissible: true,
      dismissFn: dismissals.thumb.dismiss,
      closing: dismissals.thumb.closing
    }] : []),
    ...(isScholarshipEligible && scholarshipApplicationReceived?.active && !dismissals.received.dismissed ? [{
      id: 'received',
      type: 'success',
      icon: '✅',
      title: 'Scholarship Application Received',
      desc: 'Documents submitted successfully. Awaiting verification updates.',
      dismissible: true,
      dismissFn: dismissals.received.dismiss,
      closing: dismissals.received.closing
    }] : []),
    ...(isScholarshipEligible && scholarshipApplicationsOpen?.active && !dismissals.open.dismissed ? [{
      id: 'open',
      type: 'info',
      icon: '📅',
      title: 'Scholarship Applications Open',
      desc: `Window: ${formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)} — ${formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}`,
      action: { label: 'Apply Now', href: 'https://telanganaepass.cgg.gov.in/', target: '_blank' },
      dismissible: true,
      dismissFn: dismissals.open.dismiss,
      closing: dismissals.open.closing
    }] : []),
    ...(latestRequest && !dismissals.cert.dismissed ? [(() => {
      const safeStatus = (latestRequest.status || '').toUpperCase();
      return {
      id: 'cert',
      type: 'info',
      icon: safeStatus === 'APPROVED' ? '✅' : safeStatus === 'REJECTED' ? '❌' : '⏳',
      title: `Certificate Request: ${latestRequest.certificate_type || latestRequest.type || 'Request'}`,
      desc: safeStatus === 'APPROVED' ? 'Your certificate request has been approved!' : safeStatus === 'REJECTED' ? 'Your certificate request was rejected.' : 'Pending approval from the administration.',
      action: { label: 'View Details', href: `/student/requests/certificates?request_id=${latestRequest.request_id || latestRequest.id}&scroll=history` },
      dismissible: true,
      dismissFn: dismissals.cert.dismiss,
      closing: dismissals.cert.closing
    }})()] : [])
  ];

  if (activeAlerts.length === 0) return null;

  return (
    <section className="rounded-sm border border-slate-200 bg-white overflow-hidden shadow-xs mb-2">
      <div className="bg-[#0b3578]/5 px-4 py-2.5 lg:py-3 border-b border-slate-200 flex items-center justify-start">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0b3578]" aria-hidden="true" />
          <h2 className="text-xs font-bold text-[#0b3578] uppercase tracking-[0.18em]">
            Priority Actions
          </h2>
        </div>
      </div>
      
      <div className="p-3 sm:p-4 space-y-3 bg-slate-50/30">
      {activeAlerts.map(alert => {
        let borderColor = 'border-slate-200';
        let leftBorder = 'border-l-slate-400';
        let bgIcon = 'bg-slate-50 text-slate-700';
        let titleColor = 'text-slate-900';
        let descColor = 'text-slate-600';
        let actionColor = 'bg-[#0b3578] text-white hover:bg-blue-800';

        if (alert.type === 'critical') {
          borderColor = 'border-amber-200';
          leftBorder = 'border-l-amber-500';
          bgIcon = 'bg-amber-50 text-amber-700';
        } else if (alert.type === 'warning') {
          borderColor = 'border-indigo-200';
          leftBorder = 'border-l-indigo-500';
          bgIcon = 'bg-indigo-50 text-indigo-700';
        } else if (alert.type === 'success') {
          borderColor = 'border-emerald-200';
          leftBorder = 'border-l-emerald-500';
          bgIcon = 'bg-emerald-50 text-emerald-700';
        } else if (alert.type === 'info') {
          borderColor = 'border-blue-200';
          leftBorder = 'border-l-blue-500';
          bgIcon = 'bg-blue-50 text-blue-700';
        } else if (alert.type === 'action') {
          borderColor = 'border-blue-200';
          leftBorder = 'border-l-[#0b3578]';
          bgIcon = 'bg-[#0b3578]/10 text-[#0b3578]';
        }

        return (
          <div 
            key={alert.id}
            className={`
              relative bg-white border ${borderColor} shadow-sm rounded-sm overflow-hidden transition-[max-height,opacity,margin,padding] duration-300 ease-out
              ${alert.closing ? 'max-h-0 opacity-0 py-0 border-0 mb-0' : 'max-h-[500px] opacity-100'}
            `}
          >
            <div className={`border-l-4 ${leftBorder} p-4 flex items-start justify-between gap-4`}>
              <div className="flex items-start gap-3 w-full">
                <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 ring-1 ring-black/5 ${bgIcon}`}>
                  <span className="text-sm" aria-hidden="true">{alert.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${titleColor}`}>{alert.title}</div>
                  <div className={`text-xs mt-1 ${descColor}`}>{alert.desc}</div>
                  
                  {alert.customRender && alert.customRender()}

                  {alert.action && (
                    <div className="mt-3">
                      <Link
                        href={alert.action.href}
                        target={alert.action.target}
                        className={`inline-block px-5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] rounded-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer ${actionColor}`}
                      >
                        {alert.action.label}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              
              {alert.dismissible && (
                <button 
                  type="button"
                  onClick={alert.dismissFn}
                  className="shrink-0 -mt-1 -mr-1 p-2 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none transition-colors cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}
