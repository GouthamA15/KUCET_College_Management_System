'use client';
import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/date';

/**
 * BulkAttendanceModal
 * Confirmation modal for "Present All" and "Absent All" operations
 * Complies with Part B requirements:
 * - Explains action and affected student count
 * - Cancel leaves state unchanged
 * - Confirm executes exactly once with debouncing/loading state
 * - Mobile friendly and accessible
 */
export default function BulkAttendanceModal({
  isOpen,
  targetStatus, // 'PRESENT' | 'ABSENT'
  studentCount = 0,
  sessionNumber = 1,
  date,
  onConfirm,
  onCancel,
  submitting = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onCancel]);

  if (!isOpen) return null;

  const isPresent = targetStatus === 'PRESENT';
  const statusLabel = isPresent ? 'Present' : 'Absent';
  const formattedDate = date ? formatDate(date, '—') : '—';

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-confirm-title"
        aria-describedby="bulk-confirm-desc"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative transform transition-all my-auto"
      >
        {/* Header Bar */}
        <div
          className={`p-5 text-white relative ${
            isPresent
              ? 'bg-gradient-to-r from-emerald-700 to-green-800'
              : 'bg-gradient-to-r from-red-700 to-rose-900'
          }`}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="absolute top-4 right-4 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shrink-0">
              {isPresent ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-200" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 block">
                Bulk Attendance Confirmation
              </span>
              <h2 id="bulk-confirm-title" className="text-lg font-bold text-white leading-snug">
                Confirm {statusLabel} All
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <div id="bulk-confirm-desc" className="space-y-3 text-sm text-slate-600">
            <p>
              Are you sure you want to mark all students as{' '}
              <span
                className={`font-black uppercase ${
                  isPresent ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {statusLabel}
              </span>
              ?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-semibold uppercase">Affected Students:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{studentCount} Students</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-semibold uppercase">Session:</span>
                <span className="font-mono font-bold text-slate-900">Session S{sessionNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-semibold uppercase">Date:</span>
                <span className="font-mono font-bold text-slate-900">{formattedDate}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic">
              All students in this session will be updated immediately. Individual statuses can still be changed afterward.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wide hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isPresent
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/20'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Applying…</span>
                </>
              ) : (
                <span>Confirm {statusLabel} All</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
