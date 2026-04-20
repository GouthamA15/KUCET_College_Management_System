'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function AttendanceVerificationActivity({ sessions, onSessionVerified }) {
  const [pinByAssignment, setPinByAssignment] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [statusByAssignment, setStatusByAssignment] = useState({});

  if (!sessions || sessions.length === 0) return null;

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

      let deviceId = localStorage.getItem('kucet_device_uuid');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('kucet_device_uuid', deviceId);
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude, accuracy } = pos.coords;

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
          device_id: deviceId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Verification failed');
      }

      toast.success(json.message || 'Attendance successfully marked.');
      if (typeof onSessionVerified === 'function') {
        onSessionVerified(assignmentId, session);
      }
    } catch (err) {
      let msg = err.message || 'Verification failed';
      if (err.code === 1) msg = 'Location access denied. Please enable GPS.';
      if (err.code === 3) msg = 'Location request timed out. Please retry.';
      toast.error(msg);
      setStatusByAssignment((prev) => ({
        ...prev,
        [assignmentId]: {
          tone: 'error',
          message: msg
        }
      }));
    } finally {
      setSubmittingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return null;

    let d = String(value).trim();
    if (!d) return null;

    // Handle ISO timestamps like "2026-04-20T00:00:00.000Z" by extracting the date portion.
    if (d.includes('T')) {
      d = d.split('T')[0];
    }

    // If already in YYYY-MM-DD, format to DD-MM-YYYY.
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-');
      return `${day}-${m}-${y}`;
    }

    // If already in DD-MM-YYYY, keep it.
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
      return d;
    }

    // Fallback: try Date parsing.
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}-${month}-${year}`;
    }

    return String(value);
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const assignmentId = session.assignment_id;
        const pin = pinByAssignment[assignmentId] || '';
        const sessionDate = formatDate(session.attendance_date);
        const status = statusByAssignment[assignmentId];

        const subjectName = session.subject_name || 'Attendance Session';
        const subjectCode = session.subject_code ? String(session.subject_code) : null;
        const facultyName = session.faculty_name || 'Faculty';

        return (
          <div
            key={assignmentId}
            className="rounded-xl border border-blue-200/70 bg-blue-50/70 text-slate-800 shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#0b3578]" aria-hidden="true" />
                    <h3 className="text-sm font-bold tracking-tight text-slate-800">
                      Attendance Verification Required
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Enter the 4-digit PIN displayed by faculty
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-blue-200 bg-white/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0b3578]">
                  Secure Session
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12 md:items-start">
                <div className="md:col-span-7">
                  <div className="rounded-lg border border-blue-200/70 bg-white/60 px-3.5 py-3">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Subject</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-700 truncate">
                            {subjectName}{subjectCode ? <span className="text-slate-400 font-bold"> ({subjectCode})</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Faculty</div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-700 truncate">{facultyName}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Session Date</div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-700">{sessionDate || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-5">
                  <div className="rounded-lg border border-blue-200/70 bg-white/60 px-3.5 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">PIN</div>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={4}
                          placeholder="••••"
                          value={pin}
                          onChange={(e) => handleChangePin(assignmentId, e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tracking-[0.35em] text-slate-800 placeholder:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerify(session)}
                        disabled={submittingId === assignmentId || pin.length !== 4}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-[#0b3578]/20 hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {submittingId === assignmentId ? 'Verifying…' : 'Mark Present'}
                      </button>
                    </div>

                    {status?.tone === 'error' && status?.message && (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">Status</div>
                        <div className="mt-0.5 text-xs font-semibold text-rose-800 leading-relaxed">{status.message}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
