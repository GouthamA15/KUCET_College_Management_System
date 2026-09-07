'use client';

import React, { useState } from 'react';
import { Trophy, X, ShieldAlert } from 'lucide-react';

export default function ParticipantRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  eventKey = 'chess',
  currentUser = null
}) {
  const [displayName, setDisplayName] = useState(currentUser?.name || currentUser?.email || '');
  const [department, setDepartment] = useState(currentUser?.branch || currentUser?.department || 'CSE');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

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
          display_name: displayName,
          department,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');

      if (typeof onSuccess === 'function') onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl p-6 shadow-xl border border-slate-200 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 text-[#0b3578]">
            <Trophy className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-800">
              Register for Chess Tournament
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Full Name / Display Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Department / Branch <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Experience / Rating / Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. FIDE 1450 / Intermediate chess player"
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
