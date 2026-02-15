'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProfileActivityBar({ activity, student }) {
  const { latestRequest, dismissCount, incrementVisit, dismiss, reset } = activity || {};
  const [visible, setVisible] = useState(true);
  const [didIncrement, setDidIncrement] = useState(false);
  const isProd = typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true;

  // reset increment state when a new request or status arrives
  useEffect(() => {
    setDidIncrement(false);
    setVisible(true);
  }, [latestRequest && latestRequest.request_id, latestRequest && latestRequest.status]);

  useEffect(() => {
    if (!latestRequest) return;
    // Only increment when the bar will actually render. In development ignore the limit.
    const canIncrement = isProd ? (dismissCount < 4) : true;
    if (!didIncrement && typeof incrementVisit === 'function' && canIncrement && visible) {
      incrementVisit();
      setDidIncrement(true);
    }
  }, [latestRequest, dismissCount, didIncrement, incrementVisit, visible, isProd]);

  // Hide entirely if user dismissed enough times (only in production)
  if (latestRequest && dismissCount >= 4 && isProd) return null;

  // If there's no certificate request, render the legacy warning bar (email/password warnings)
  if (!latestRequest) {
    if (!student) return null;
    const show = (!student.email || !student.is_email_verified || !student.password_hash);
    if (!show) return null;
    return (
      <div className="w-full flex justify-center px-6 pt-4">
        <div className="w-full max-w-6xl">
          <div className="border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-md p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm">
                {(!student.email) && (
                  <span>⚠️ Email not added. Please set your email and password to use portal features.</span>
                )}
                {(student.email && !student.is_email_verified) && (
                  <span>⚠️ Email verification required. Please verify your email to use portal features.</span>
                )}
                {(!student.password_hash && student.email && student.is_email_verified) && (
                  <span>⚠️ Password not set. Please set a password to continue.</span>
                )}
              </div>
              <Link href="/student/settings/security" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline">Go to Security & Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = (latestRequest.status || '').toUpperCase();
  const type = latestRequest.certificate_type || latestRequest.type || 'certificate';
  const id = latestRequest.request_id || latestRequest.requestId || latestRequest.id;

  const handleDismiss = () => {
    setVisible(false);
    if (typeof dismiss === 'function') dismiss();
  };

  const handleReset = () => {
    if (typeof reset === 'function') reset();
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/student/requests/download/${id}`, { method: 'GET', credentials: 'same-origin' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  };

  if (!visible) return null;

  // Approved
  if (status === 'APPROVED') {
    return (
      <div className="w-full flex justify-center px-6 pt-4">
        <div className="w-full max-w-6xl">
          <div className="border border-green-200 bg-green-50 text-green-800 rounded-md p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">Your {type} request is <span className="font-semibold">approved</span>.</div>
              <div className="flex items-center gap-2">
                <Link href={`/student/requests/certificates?request_id=${encodeURIComponent(id)}&scroll=history`} className="text-sm text-blue-700 hover:underline">View Details</Link>
                <button onClick={handleDismiss} className="ml-2 text-sm text-gray-600">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejected
  if (status === 'REJECTED') {
    return (
      <div className="w-full flex justify-center px-6 pt-4">
        <div className="w-full max-w-6xl">
          <div className="border border-red-200 bg-red-50 text-red-800 rounded-md p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">Your {type} request was <span className="font-semibold">rejected</span>. You may view details or re-apply.</div>
              <div className="flex items-center gap-2">
                <Link href={`/student/requests/certificates?request_id=${encodeURIComponent(id)}&scroll=history`} className="text-sm text-red-600 hover:underline">View Details</Link>
                <button onClick={handleDismiss} className="ml-2 text-sm text-gray-600">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pending / default
  return (
    <div className="w-full flex justify-center px-6 pt-4">
      <div className="w-full max-w-6xl">
        <div className="border border-blue-200 bg-blue-50 text-blue-800 rounded-md p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">Your {type} request is <span className="font-semibold">pending</span>. We'll notify you when it's processed.</div>
            <div className="flex items-center gap-2">
              <Link href={`/student/requests/certificates?request_id=${encodeURIComponent(id)}&scroll=history`} className="text-sm text-blue-700 hover:underline">View Details</Link>
              <button onClick={handleDismiss} className="ml-2 text-sm text-gray-600">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
