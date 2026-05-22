'use client';
import { useEffect, useRef } from 'react';
import RecordStatusBadge from './RecordStatusBadge';
import FeeSummaryView from './FeeSummaryView';
import ScholarshipProceedingsView from './ScholarshipProceedingsView';
import { smoothScrollToElement } from '@/lib/scroll-utils';

export default function YearRecordCard({
  year,
  index,
  summary,
  isExpanded,
  onToggleExpand,
  onOpenModal,
  recordState,
  hasRecords,
  student,
  feeSummaryMerged,
  toDmy,
}) {
  const label = hasRecords ? 'Edit Record' : 'Add Record';
  const detailsId = `year-details-${year}`;
  const cardRef = useRef(null);

  const stateStyle = (() => {
    if (recordState === 'COMPLETED') {
      return {
        accent: 'border-l-emerald-400',
        headerTone: 'text-emerald-800',
      };
    }
    if (recordState === 'PENDING') {
      return {
        accent: 'border-l-amber-400',
        headerTone: 'text-amber-800',
      };
    }
    return {
      accent: 'border-l-slate-300',
      headerTone: 'text-slate-700',
    };
  })();

  const latestProceeding = (Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0)
    ? summary.scholarship_proceedings[summary.scholarship_proceedings.length - 1]
    : null;

  const sanctionDate = latestProceeding?.date || null;
  const hardcopy = summary?.hardcopy_submitted;
  const hardcopyLabel = (hardcopy === 1 || hardcopy === true) ? 'Submitted' : (hardcopy === 0 || hardcopy === false) ? 'Pending' : '-';

  useEffect(() => {
    if (isExpanded) {
      smoothScrollToElement(cardRef.current, { behavior: 'smooth', block: 'start' });
    }
  }, [isExpanded]);

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${stateStyle.accent} shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${stateStyle.headerTone}`}>Year {index + 1}</p>
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-slate-900 tracking-tight">{year}</h4>
            <RecordStatusBadge state={recordState} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleExpand(year)}
            className="px-3 py-2 rounded-md border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            type="button"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            type="button"
            onClick={() => onOpenModal(year)}
            className="px-3 py-2 rounded-md bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#0b3578]/15 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            {label}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application No</span>
          <span className="text-[11px] font-semibold text-slate-700">{summary?.application_no || '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Fee</span>
          <span className="text-[11px] font-semibold text-slate-700">{feeSummaryMerged?.pending_fee ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proceeding No</span>
          <span className="text-[11px] font-semibold text-slate-700">{latestProceeding?.proceeding_no || '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sanctioned</span>
          <span className="text-[11px] font-semibold text-slate-700">{latestProceeding?.amount ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sanction Date</span>
          <span className="text-[11px] font-semibold text-slate-700">{sanctionDate ? (toDmy?.(sanctionDate) || sanctionDate) : '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Paid</span>
          <span className="text-[11px] font-semibold text-slate-700">{feeSummaryMerged?.student_paid ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thumb Update Available</span>
          <span className="text-[11px] font-semibold text-slate-700">{summary?.thumb_update_available ? 'YES' : 'NO'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hardcopy Submitted</span>
          <span className="text-[11px] font-semibold text-slate-700">{hardcopyLabel}</span>
        </div>
        {summary?.thumb_update_available && (
          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thumb Verification Status</span>
            <span className="text-[11px] font-semibold text-slate-700">{String(summary?.thumb_status || 'Pending').toUpperCase()}</span>
          </div>
        )}
      </div>

      <div
        id={detailsId}
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out ${
          isExpanded ? 'mt-4 max-h-[1000px] opacity-100' : 'mt-0 max-h-0 opacity-0'
        }`}
        aria-hidden={!isExpanded}
      >
        <FeeSummaryView feeSummary={feeSummaryMerged} />
        <ScholarshipProceedingsView student={student} summary={summary} toDmy={toDmy} />
      </div>
    </div>
  );
}
