"use client";
import React, { useMemo } from 'react';

/**
 * Preview modal for bulk finalization of verified student admissions.
 * Displays alphabetical mapping of applicants to their assigned institutional roll numbers
 * and dispatches bulk finalization with live feedback.
 */
export default function FinalizeAllPreviewModal({
  isOpen,
  onClose,
  drafts = [],
  rollNumbers = {},
  getRollValidation,
  workspace = {},
  onConfirmFinalizeAll,
  isFinalizing = false,
  finalizationResults = null
}) {
  // Map drafts with their current roll number and validation status
  const previewItems = useMemo(() => {
    return drafts.map((draft, index) => {
      const rollNo = rollNumbers[draft.id] || '';
      const validation = getRollValidation(rollNo, draft);
      const result = finalizationResults?.results?.find(r => r.draftId === draft.id);

      return {
        index: index + 1,
        draft,
        rollNo,
        validation,
        result
      };
    });
  }, [drafts, rollNumbers, getRollValidation, finalizationResults]);

  const invalidCount = useMemo(() => {
    return previewItems.filter(item => !item.validation.isValid).length;
  }, [previewItems]);

  const allValid = previewItems.length > 0 && invalidCount === 0;
  const isFinished = !!finalizationResults;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 id="preview-modal-title" className="text-lg font-bold text-gray-900 leading-tight">
                Finalize All Admissions — Roll Number Mapping
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <span className="font-semibold text-[#0b3578]">{workspace.targetBranch || 'BRANCH'}</span>
                <span>•</span>
                <span>{workspace.intakeExam || 'EXAM'}</span>
                <span>•</span>
                <span>Year {workspace.entryYear || ''}</span>
                <span>•</span>
                <span className="font-medium text-gray-700">{drafts.length} Student{drafts.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            disabled={isFinalizing}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Informational Guidance Banner */}
        <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-[#0b3578] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="leading-relaxed">
            Review the roll number mapping for all students in alphabetical order before proceeding. Finalizing will convert each draft into an official institutional record and immediately dispatch welcome emails with portal access instructions.
          </p>
        </div>

        {/* Validation Status Notice */}
        {!isFinished && (
          <div className="px-6 py-3 border-b border-gray-100">
            {allValid ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Ready to Finalize: All {previewItems.length} roll numbers are validated and mapped in correct order.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>
                  Action Required: {invalidCount} student{invalidCount === 1 ? '' : 's'} lack a valid roll number. Please close this preview and generate or enter valid roll numbers for all rows.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Completion Result Banner */}
        {isFinished && (
          <div className="px-6 py-3 border-b border-gray-100">
            {finalizationResults.failed === 0 ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-200">
                <span className="text-base">🎉</span>
                <span>Successfully finalized all {finalizationResults.successful} students! Official accounts created and portal activation emails sent.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-200">
                <span>⚠️</span>
                <span>Finalized {finalizationResults.successful} student(s) with {finalizationResults.failed} issue(s). Review details below.</span>
              </div>
            )}
          </div>
        )}

        {/* Roll Number Mapping Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
            <table className="min-w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-12 text-center border-r border-gray-200">#</th>
                  <th className="px-4 py-3 border-r border-gray-200">Applicant Name</th>
                  <th className="px-4 py-3 w-52 border-r border-gray-200 text-center">Institutional Roll Number</th>
                  <th className="px-4 py-3 w-40 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewItems.map(({ index, draft, rollNo, validation, result }) => {
                  return (
                    <tr key={draft.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-center text-gray-400 font-bold border-r border-gray-100">
                        {index}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-100">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{draft.name}</span>
                          <span className="text-[11px] text-gray-400">
                            {draft.email} • <span className="font-medium text-[#0b3578]">{draft.branch}</span> ({draft.entrance_exam})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-100 text-center">
                        {rollNo ? (
                          <span className={`inline-block font-mono font-bold tracking-widest text-xs px-2.5 py-1 rounded border ${
                            validation.isValid 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {rollNo}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {result ? (
                          result.success ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Finalized & Emailed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={result.error}>
                              ⚠️ {result.error || 'Failed'}
                            </span>
                          )
                        ) : isFinalizing ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 animate-pulse">
                            Processing...
                          </span>
                        ) : validation.isValid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            ⚠️ {validation.error || 'Required'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Total Students: <strong className="text-gray-900">{drafts.length}</strong>
            {invalidCount > 0 && (
              <span className="ml-2 text-rose-600 font-semibold">({invalidCount} Invalid)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isFinalizing}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {isFinished ? 'Close' : 'Cancel'}
            </button>

            {!isFinished && (
              <button
                type="button"
                onClick={onConfirmFinalizeAll}
                disabled={!allValid || isFinalizing}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#0b3578] text-white rounded-md text-xs font-bold hover:bg-blue-900 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {isFinalizing ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Finalizing All Students...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirm & Finalize All ({drafts.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
