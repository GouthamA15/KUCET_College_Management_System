'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, CheckCircle, X, Loader2 } from 'lucide-react';

/**
 * Reusable modal for adding or editing the topic covered during a lecture session
 */
export default function LectureTopicModal({
  isOpen,
  assignmentId,
  date,
  session,
  initialTopic = '',
  onClose,
  onTopicSaved
}) {
  const [topic, setTopic] = useState(initialTopic || '');
  const [prevInitial, setPrevInitial] = useState(initialTopic);
  const [submitting, setSubmitting] = useState(false);

  if (initialTopic !== prevInitial) {
    setPrevInitial(initialTopic);
    setTopic(initialTopic || '');
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialTopic && initialTopic.trim().length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/faculty/attendance/session/topic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          date,
          session,
          topic_covered: topic
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save lecture topic');
      }

      toast.success(isEditing ? 'Lecture topic updated' : 'Lecture topic saved successfully');
      if (onTopicSaved) {
        onTopicSaved(data.data?.topic_covered ?? topic.trim());
      }
      onClose();
    } catch (_err) {
      toast.error('Attendance was saved, but the lecture topic could not be saved. You can add it later from Attendance History.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-modal-title"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative transform transition-all my-auto"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#0b3578] to-indigo-900 p-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="absolute top-4 right-4 p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shrink-0">
              {isEditing ? <BookOpen className="w-5 h-5" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 block">
                {isEditing ? 'Edit Teaching Record' : 'Lecture Completed'}
              </span>
              <h2 id="topic-modal-title" className="text-lg font-bold text-white leading-snug">
                {isEditing ? 'Update Topic Covered' : 'Add Topic Covered in Lecture'}
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="topic-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Topic Covered <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <span className="text-[10px] font-mono font-semibold text-slate-400">
                {topic.length} / 500
              </span>
            </div>
            <textarea
              id="topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 500))}
              placeholder="e.g. Deadlocks and Banker's Algorithm"
              rows={3}
              maxLength={500}
              disabled={submitting}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:border-[#0b3578] focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50"
              autoFocus
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Maintaining session-level topics helps you track syllabus completion and teaching progress in Attendance History.
            </p>
          </div>

          {/* Meta Info Pill */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Session Info</span>
              <span>{date || '—'} (Session {session || '1'})</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#0b3578] border border-blue-100 uppercase">
              Lecture Session
            </span>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEditing ? 'Cancel' : 'Skip'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0b3578] hover:bg-blue-900 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>{isEditing ? 'Update Topic' : 'Save Topic'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
