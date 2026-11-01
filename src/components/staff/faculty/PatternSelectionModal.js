'use client';

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  BookOpen, 
  Layers, 
  Ban,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  THEORY_ASSESSMENT_PATTERNS, 
  getTheoryPattern, 
  checkPatternSwitchCompatibility 
} from '@/lib/evaluation-utils';

export default function PatternSelectionModal({
  isOpen,
  assignment,
  existingMarks = [],
  currentPatternId = null,
  isPublished = false,
  isChanging = false,
  isLocked = false,
  isOverride = false,
  onSelectPattern,
  onClose
}) {
  const [selectedPatternId, setSelectedPatternId] = useState(currentPatternId || null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  // Available pattern cards
  const patterns = [
    THEORY_ASSESSMENT_PATTERNS.PATTERN_1,
    THEORY_ASSESSMENT_PATTERNS.PATTERN_2,
    THEORY_ASSESSMENT_PATTERNS.PATTERN_3
  ];

  // Derive compatibility check directly without synchronous setState in effect
  const compatCheck = useMemo(() => {
    if (!selectedPatternId) return { compatible: true };
    const targetPattern = getTheoryPattern(selectedPatternId);
    if (!targetPattern || !existingMarks || existingMarks.length === 0) {
      return { compatible: true };
    }
    return checkPatternSwitchCompatibility(existingMarks, targetPattern);
  }, [selectedPatternId, existingMarks]);

  if (!isOpen || !assignment) return null;

  const hasExistingDraftMarks = existingMarks && existingMarks.some(s => 
    (s.mid1_marks !== '' && s.mid1_marks !== null && s.mid1_marks !== undefined) ||
    (s.mid2_marks !== '' && s.mid2_marks !== null && s.mid2_marks !== undefined) ||
    (s.assignment_marks !== '' && s.assignment_marks !== null && s.assignment_marks !== undefined)
  );

  const isSameAsCurrent = currentPatternId && selectedPatternId === currentPatternId;

  const handleCardClick = (patternId) => {
    if (isPublished || (isLocked && !isOverride)) return;
    setSelectedPatternId(patternId);
    setConfirmationNeeded(false);
  };

  const handleKeyDown = (e, patternId) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleCardClick(patternId);
    }
  };

  const handleProceed = async () => {
    if (!selectedPatternId) {
      toast.error('Please select an assessment pattern to proceed');
      return;
    }

    const targetPattern = getTheoryPattern(selectedPatternId);
    if (!targetPattern) {
      toast.error('Invalid assessment pattern selected');
      return;
    }

    if (!compatCheck.compatible) {
      toast.error(compatCheck.reason || 'Existing marks exceed target pattern limits');
      return;
    }

    if (isOverride) {
      const cleanReason = overrideReason.trim();
      if (!cleanReason || cleanReason.length < 5) {
        toast.error('A meaningful reason (at least 5 characters) is required for pattern override.');
        return;
      }
    } else if (isLocked) {
      toast.error('Assessment pattern is permanently locked because marks have been saved.');
      return;
    }

    // Require confirmation if changing pattern with existing draft marks
    if (isChanging && hasExistingDraftMarks && !isSameAsCurrent && !confirmationNeeded && !isOverride) {
      setConfirmationNeeded(true);
      return;
    }

    setSubmitting(true);
    try {
      await onSelectPattern({
        pattern: targetPattern,
        reason: overrideReason.trim(),
        isOverride
      });
    } catch (err) {
      toast.error(err.message || 'Failed to apply assessment pattern');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp"
      >
        {/* Modal Header */}
        <div className={`text-white px-5 py-4 flex items-start justify-between ${isOverride ? 'bg-amber-900' : 'bg-[#0b3578]'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0">
              {isOverride ? <ShieldAlert className="w-5 h-5 text-amber-300" /> : <Layers className="w-5 h-5 text-amber-300" />}
            </div>
            <div>
              <h2 id="pattern-modal-title" className="text-base font-bold tracking-tight">
                {isOverride ? 'Administrative Pattern Override (HOD / Admin)' : isChanging ? 'Change Theory Assessment Pattern' : 'Select Theory Assessment Pattern'}
              </h2>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                {assignment.subject_name} ({assignment.subject_code}) • {assignment.branch} Sem {assignment.course_semester}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Regulatory Context Notice */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-md p-3 text-xs text-slate-700 leading-relaxed flex gap-2.5 items-start">
            <BookOpen className="w-4 h-4 text-[#0b3578] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#0b3578]">Continuous Internal Evaluation (CIE) Scheme:</span>{' '}
              Select the university-approved assessment pattern for this subject. In all patterns, the overall CIE maximum is <strong className="text-slate-900">30 marks</strong>, and the Mid contribution is computed as the <strong className="text-slate-900">Best of MID-1 and MID-2</strong>.
            </div>
          </div>

          {/* Published Warning */}
          {isPublished && (
            <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800 flex items-center gap-2 font-semibold">
              <Ban className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Marks for this subject have been published and finalized. The assessment pattern is permanently locked.</span>
            </div>
          )}

          {/* Permanent Lock Warning (Ordinary Faculty) */}
          {isLocked && !isOverride && !isPublished && (
            <div className="bg-slate-100 border border-slate-300 rounded-md p-3 text-xs text-slate-800 flex items-center gap-2 font-semibold">
              <Ban className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Assessment pattern is locked because marks have been saved. Only an authorized HOD or Super Admin can override this pattern.</span>
            </div>
          )}

          {/* Override Reason Box */}
          {isOverride && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>Override Authorization Justification (Mandatory)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This subject has existing saved marks. Overriding the assessment pattern requires a formal reason and will be permanently recorded in the institutional audit log.
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State the academic or administrative justification for changing the locked pattern (minimum 5 characters)..."
                rows={3}
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-800 placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Incompatibility Error Banner */}
          {!compatCheck.compatible && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Pattern Switch Incompatible:</strong>
                <p>{compatCheck.reason}</p>
              </div>
            </div>
          )}

          {/* Confirmation Warning Banner */}
          {confirmationNeeded && compatCheck.compatible && !isOverride && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Confirmation Required:</strong>
                <p>
                  Draft marks exist for this subject. Switching to{' '}
                  <strong className="text-amber-950 font-bold">{getTheoryPattern(selectedPatternId)?.name}</strong> will update the evaluation structure and recalculate student totals under the new maxima.
                </p>
              </div>
            </div>
          )}

          {/* Pattern Options Grid */}
          <div className="space-y-3 pt-1">
            {patterns.map((p) => {
              const isSelected = selectedPatternId === p.id;
              const isCurrent = currentPatternId === p.id;
              const disabled = isPublished || (isLocked && !isOverride);

              return (
                <div
                  key={p.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => handleCardClick(p.id)}
                  onKeyDown={(e) => handleKeyDown(e, p.id)}
                  className={`
                    relative border rounded-lg p-4 transition-all
                    ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-[#0b3578]/60 hover:shadow-sm'}
                    ${isSelected 
                      ? 'border-[#0b3578] bg-blue-50/40 ring-2 ring-[#0b3578]/20 shadow-xs' 
                      : 'border-slate-200 bg-white'}
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-[#0b3578]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              Current
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100/70 text-[#0b3578]">
                            {p.summary}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{p.description}</p>

                        {/* Breakdown Pills */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-700">
                            MID-1: {p.midMax} max
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-700">
                            MID-2: {p.midMax} max
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            p.hasAssignment 
                              ? 'bg-white border-slate-200 text-slate-700' 
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}>
                            Assignment: {p.hasAssignment ? `${p.assignmentMax} max` : 'Not Applicable'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#0b3578]/10 text-[#0b3578] border border-[#0b3578]/20">
                            Total: 30 marks
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-white transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={
              !selectedPatternId || 
              submitting || 
              isPublished || 
              (isLocked && !isOverride) ||
              !compatCheck.compatible
            }
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-white rounded-md text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer ${
              isOverride ? 'bg-amber-700 hover:bg-amber-800' : 'bg-[#0b3578] hover:bg-[#092b60]'
            }`}
          >
            {submitting ? (
              <span>Saving...</span>
            ) : isOverride ? (
              <span>Confirm Override & Apply</span>
            ) : confirmationNeeded ? (
              <span>Confirm & Apply Pattern</span>
            ) : isChanging ? (
              <span>Update Pattern</span>
            ) : (
              <>
                <span>Continue to Marks Entry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
