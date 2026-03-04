'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function AttendanceVerificationActivity({ sessions, onSessionVerified }) {
  const [pinByAssignment, setPinByAssignment] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  if (!sessions || sessions.length === 0) return null;

  const handleChangePin = (assignmentId, value) => {
    const numeric = value.replace(/\D/g, '').slice(0, 4);
    setPinByAssignment(prev => ({ ...prev, [assignmentId]: numeric }));
  };

  const handleVerify = async (session) => {
    const assignmentId = session.assignment_id;
    const pin = pinByAssignment[assignmentId] || '';

    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN shown on faculty screen');
      return;
    }

    setSubmittingId(assignmentId);
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
    } finally {
      setSubmittingId(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    if (d.includes('-')) {
      const [y, m, day] = d.split('-');
      return `${day}-${m}-${y}`;
    }
    return d;
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const assignmentId = session.assignment_id;
        const pin = pinByAssignment[assignmentId] || '';
        const sessionDate = formatDate(session.attendance_date);

        return (
          <div
            key={assignmentId}
            className="border border-gray-300 rounded-md bg-white p-3 text-sm"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-800">Attendance Verification Required</div>
                <p className="text-xs text-gray-600 mt-0.5">
                  Enter the 4-digit PIN displayed by faculty.
                </p>
                <p className="text-xs text-gray-700 mt-2">
                  {session.subject_name} ({session.subject_code})
                </p>
                {session.faculty_name && (
                  <p className="text-xs text-gray-500">Faculty: {session.faculty_name}</p>
                )}
                {sessionDate && (
                  <p className="text-xs text-gray-500">Session Date: {sessionDate}</p>
                )}
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => handleChangePin(assignmentId, e.target.value)}
                  className="w-16 border border-gray-300 rounded-md px-2 py-1 text-center text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleVerify(session)}
                  disabled={submittingId === assignmentId || pin.length !== 4}
                  className="bg-[#0b3578] text-white px-3 py-1 rounded-md text-sm disabled:opacity-60"
                >
                  {submittingId === assignmentId ? 'Verifying...' : 'Mark Present'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
