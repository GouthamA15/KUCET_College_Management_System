'use client';
import { useEffect, useRef } from 'react';
import RecordStatusBadge from './RecordStatusBadge';
import FeeSummaryView from './FeeSummaryView';
import ScholarshipProceedingsView from './ScholarshipProceedingsView';

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

  useEffect(() => {
    if (isExpanded && cardRef.current && typeof window !== 'undefined') {
      try {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [isExpanded]);

  return (
    <div ref={cardRef} className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Year {index + 1}</h3>
          <div className="text-sm text-gray-500">{year}</div>
          <div className="mt-2 text-sm text-gray-700">
            <div>Application: <span className="font-medium">{summary?.application_no || '-'}</span></div>
            {summary && (
              <div className="mt-1 text-sm text-gray-600">
                <div>Proceeding: <span className="font-medium">{(Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length>0) ? summary.scholarship_proceedings[summary.scholarship_proceedings.length-1].proceeding_no : '-'}</span></div>
                <div>Sanctioned: <span className="font-medium">{(Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length>0) ? summary.scholarship_proceedings[summary.scholarship_proceedings.length-1].amount : '-'}</span></div>
                <div>Sanction Date: <span className="font-medium">{summary?.scholarship_proceedings && summary.scholarship_proceedings.length>0 ? (summary.scholarship_proceedings[summary.scholarship_proceedings.length-1].date || '-') : '-'}</span></div>
                <div>Student Paid: <span className="font-medium">{feeSummaryMerged?.student_paid ?? '-'}</span></div>
                <div>Thumb Update: <span className="font-medium">{summary?.thumb_update_available ? 'Yes' : 'No'}</span></div>
                {summary?.thumb_update_available && (
                  <div>Thumb Status: <span className="font-medium">{summary?.thumb_status || 'Pending'}</span></div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RecordStatusBadge state={recordState} />
          <button
            onClick={() => onToggleExpand(year)}
            className="px-3 py-1 rounded border"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            type="button"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={() => onOpenModal(year)} className="px-3 py-1 rounded bg-indigo-600 text-white">{label}</button>
        </div>
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
