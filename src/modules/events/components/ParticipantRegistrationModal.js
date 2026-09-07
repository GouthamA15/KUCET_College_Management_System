'use client';

import React, { useState } from 'react';
import { Trophy, X, ShieldAlert, ShieldCheck, UserCheck, Loader2 } from 'lucide-react';

export default function ParticipantRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  eventKey = 'chess',
  currentUser = null
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const candidateName = currentUser?.name || currentUser?.full_name || 'KUCET Candidate';
  const candidateId = currentUser?.roll_no || currentUser?.id || currentUser?.staffId || 'Verified Account';
  const candidateDept = currentUser?.branch || currentUser?.department || 'KUCET Engineering';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/events/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: eventKey,
          notes: notes.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete registration');

      if (typeof onSuccess === 'function') onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-md p-5 sm:p-6 shadow-xl border border-gray-300 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2 text-[#0b3578]">
            <Trophy className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-800">
              Tournament Entry Confirmation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Read-Only Verified Candidate Identity Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Candidate Identity
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3" /> KUCET Verified
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[11px] text-gray-500 block">Candidate Name</span>
              <span className="font-semibold text-gray-800">{candidateName}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block">Roll No / ID</span>
              <span className="font-mono font-semibold text-gray-800">{candidateId}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-gray-500 block">Department / Discipline</span>
              <span className="font-semibold text-gray-800">{candidateDept}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              FIDE Rating / Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Intermediate player / FIDE ID 14205"
              rows={2}
              className="w-full px-3 py-2 text-xs rounded border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-xs sm:text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Confirm Entry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
