'use client';
import StudentPaymentsView from './StudentPaymentsView';

export default function AddEditRecordModal({
  open,
  year,
  student,
  summary,
  formState,
  setFormState,
  saving,
  onSave,
  onClose,
  onDeletePayment,
  onDeleteScholarship,
  toDmy,
}) {
  if (!open) return null;
  const isScholar = student?.fee_reimbursement === 'YES';
  const isSfc = String(student?.fee_category).toUpperCase() === 'SFC';
  const feeFieldsLocked = isScholar && !isSfc;
  const existingApp = String(summary?.application_no || '').trim();
  const hasExistingApp = existingApp !== '';

  const setField = (k, v) => setFormState?.(k, v);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl">
        <div className="flex justify-between items-center mb-3">
          {(() => {
            const summaryExists = Boolean(
              summary?.application_no ||
              (Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0) ||
              (Array.isArray(summary?.student_payments) && summary.student_payments.length > 0)
            );
            const label = summaryExists ? 'Edit Record' : 'Add Record';
            return (<h3 className="text-lg font-semibold">{label} — {year}</h3>);
          })()}
          <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fee Particulars */}
          <div className="p-4 bg-gray-50 rounded">
            <h4 className="font-semibold mb-2">Fee Particulars</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Total Fee</label>
                <div className="mt-1 px-3 py-2 border rounded w-full bg-white">{summary?.fee_summary?.total_fee ?? '-'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Student Paid Amount</label>
                <input value={formState.payAmount || ''} onChange={(e) => setField('payAmount', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Transaction Ref (UTR/Challan)</label>
                <input value={formState.payRef || ''} onChange={(e) => setField('payRef', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Transaction Date</label>
                <input type="date" value={formState.payDate || ''} onChange={(e) => setField('payDate', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
            </div>
          </div>

          {/* Scholarship Particulars */}
          {isScholar && (
            <div className="p-4 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Scholarship Particulars</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600">Application Number</label>
                  <div className="relative">
                    <input
                      value={formState.schAppNo || ''}
                      onChange={(e) => setField('schAppNo', e.target.value)}
                      disabled={!formState.appEditing && hasExistingApp}
                      className={`mt-1 px-3 py-2 border rounded w-full ${(!formState.appEditing && hasExistingApp) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                    {hasExistingApp && (
                      <div className="mt-1 text-xs text-amber-700">Existing Application Number found. Editing should be done with caution.</div>
                    )}
                    {hasExistingApp && (
                      <div className="mt-2 flex items-center gap-2">
                        {!formState.appEditing ? (
                          <button type="button" onClick={() => setField('appEditing', true)} className="px-2 py-1 text-xs rounded border">Edit</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setField('appEditing', false); setField('schAppNo', existingApp); }} className="px-2 py-1 text-xs rounded border">Cancel Edit</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Proceeding Number</label>
                  <input value={formState.schProceedingNo || ''} onChange={(e) => setField('schProceedingNo', e.target.value)} className="mt-1 px-3 py-2 border rounded w-full" />
                  <div className="mt-1 text-xs text-gray-600">Proceeding number may be added later if not yet issued.</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Sanctioned Amount</label>
                  <input
                    value={formState.schAmount || ''}
                    onChange={(e) => setField('schAmount', e.target.value)}
                    disabled={!String(formState.schProceedingNo || '').trim()}
                    className={`mt-1 px-3 py-2 border rounded w-full ${!String(formState.schProceedingNo || '').trim() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {!String(formState.schProceedingNo || '').trim() && (
                    <div className="mt-1 text-xs text-gray-600">Enter Proceeding Number to add sanctioned amount.</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Sanction Date</label>
                  <input type="date" value={formState.schDate || ''} onChange={(e) => setField('schDate', e.target.value)} className="mt-1 px-3 py-2 border rounded w-full" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Existing records */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <StudentPaymentsView payments={summary?.student_payments || []} onDelete={onDeletePayment} toDmy={toDmy} />
          {student?.fee_reimbursement === 'YES' && (
            <div className="p-4 bg-white rounded border">
              <h4 className="font-semibold mb-2">Existing Scholarship Proceedings</h4>
              {Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0 ? (
                <div className="space-y-2">
                  {summary.scholarship_proceedings.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border rounded p-2">
                      <div className="text-sm">{s.proceeding_no}</div>
                      <div className="text-sm">{s.amount}</div>
                      <div className="text-sm">{toDmy?.(s.date)}</div>
                      <button onClick={() => onDeleteScholarship?.(s.id)} className="text-red-600 text-xs">Delete</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No records yet.</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
