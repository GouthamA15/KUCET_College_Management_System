'use client';
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
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Year {index + 1}</h3>
          <div className="text-sm text-gray-500">{year}</div>
        </div>
        <div className="flex items-center gap-2">
          <RecordStatusBadge state={recordState} />
          <button onClick={() => onToggleExpand(year)} className="px-3 py-1 rounded border">
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={() => onOpenModal(year)} className="px-3 py-1 rounded bg-indigo-600 text-white">{label}</button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeeSummaryView feeSummary={feeSummaryMerged} />
          <ScholarshipProceedingsView student={student} summary={summary} toDmy={toDmy} />
        </div>
      )}
    </div>
  );
}
