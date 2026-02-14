'use client';
import React from 'react';

export default function ProfileWarningBar({ student }) {
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
            <a href="/student/settings/security" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline">Go to Security & Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
