'use client';
import YearRecordCard from './YearRecordCard';

export default function YearRecordsList({
  yearList,
  summariesByYear,
  expandedByYear,
  onToggleExpand,
  onOpenModal,
  computeRecordState,
  feeSummary,
  student,
  toDmy,
}) {
  return (
    <div className="space-y-4">
      {(yearList || []).map((y, idx) => {
        const summary = summariesByYear[y] || null;
        const recordState = computeRecordState(summary, feeSummary);
        const hasRecords = Boolean(
          (summary?.application_no) ||
          (Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0) ||
          (Array.isArray(summary?.student_payments) && summary.student_payments.length > 0)
        );
        const isExpanded = !!expandedByYear[y];
        const feeSummaryMerged = (() => {
          const fs = summary?.fee_summary || {};
          const totalFee = fs.total_fee ?? feeSummary?.total_fee ?? '-';
          const govtPaid = fs.govt_paid ?? 0;
          const studentPaid = fs.student_paid ?? 0;
          const pendingFee = fs.pending_fee ?? ((totalFee === '-' || totalFee == null) ? '-' : totalFee);
          return { total_fee: totalFee, govt_paid: govtPaid, student_paid: studentPaid, pending_fee: pendingFee };
        })();
        return (
          <YearRecordCard
            key={y}
            year={y}
            index={idx}
            summary={summary}
            isExpanded={isExpanded}
            onToggleExpand={(yy) => onToggleExpand?.(yy)}
            onOpenModal={(yy) => onOpenModal?.(yy)}
            recordState={recordState}
            hasRecords={hasRecords}
            student={student}
            feeSummaryMerged={feeSummaryMerged}
            toDmy={toDmy}
          />
        );
      })}
    </div>
  );
}
