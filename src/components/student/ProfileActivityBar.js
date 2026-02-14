'use client';
import React from 'react';

export default function ProfileActivityBar({ latestRequest, dismissCount, onDismiss, onReset }) {
  if (!latestRequest) return null;
  return (
    <div className="w-full flex justify-center px-6 pt-4">
      <div className="w-full max-w-6xl">
        <div className="border border-blue-200 bg-blue-50 text-blue-800 rounded-md p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">Latest request: <span className="font-semibold">{latestRequest.title || latestRequest.type || 'Request'}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={onDismiss} className="text-sm text-gray-600 hover:underline">Dismiss ({dismissCount})</button>
              <button onClick={onReset} className="text-sm text-blue-700 font-semibold hover:underline">Reset</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
