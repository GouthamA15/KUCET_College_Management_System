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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b sticky top-0 bg-white z-10">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Particulars */}
          <div className="p-4 border rounded-md bg-gray-50">
            <h4 className="font-semibold mb-2">Fee Particulars</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Total Fee</label>
                <div className="mt-1 w-full px-3 py-2 text-sm border rounded-md bg-white">{summary?.fee_summary?.total_fee ?? '-'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Student Paid Amount</label>
                <input value={formState.payAmount || ''} onChange={(e) => setField('payAmount', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 w-full px-3 py-2 text-sm border rounded-md ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Transaction Ref (UTR/Challan)</label>
                <input value={formState.payRef || ''} onChange={(e) => setField('payRef', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 w-full px-3 py-2 text-sm border rounded-md ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Transaction Date</label>
                <input type="date" value={formState.payDate || ''} onChange={(e) => setField('payDate', e.target.value)} disabled={feeFieldsLocked} className={`mt-1 w-full px-3 py-2 text-sm border rounded-md ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              </div>
            </div>
          </div>

          {/* Scholarship Particulars */}
          {isScholar && (
            <div className="p-4 border rounded-md bg-gray-50">
              <h4 className="font-semibold mb-2">Scholarship Particulars</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600">Application Number</label>
                  <div className="relative">
                    <input
                      value={formState.schAppNo || ''}
                      onChange={(e) => {
                        const raw = String(e.target.value || '');
                        // Allow only digits and clamp to 12 characters
                        const numeric = raw.replace(/\D/g, '').slice(0, 12);
                        setField('schAppNo', numeric);
                      }}
                      disabled={!formState.appEditing && hasExistingApp}
                      className={`mt-1 w-full px-3 py-2 text-sm border rounded-md ${(!formState.appEditing && hasExistingApp) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      maxLength={12}
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
                <div className="mt-3">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={!!formState.hardcopySubmitted}
                      onChange={(e) => setField('hardcopySubmitted', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Hard Copies Submitted</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Proceeding Number</label>
                  <input value={formState.schProceedingNo || ''} onChange={(e) => setField('schProceedingNo', e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border rounded-md" />
                  <div className="mt-1 text-xs text-gray-600">Proceeding number may be added later if not yet issued.</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Sanctioned Amount</label>
                  <input
                    value={formState.schAmount || ''}
                    onChange={(e) => setField('schAmount', e.target.value)}
                    disabled={!String(formState.schProceedingNo || '').trim()}
                    className={`mt-1 w-full px-3 py-2 text-sm border rounded-md ${!String(formState.schProceedingNo || '').trim() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {!String(formState.schProceedingNo || '').trim() && (
                    <div className="mt-1 text-xs text-gray-600">Enter Proceeding Number to add sanctioned amount.</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Sanction Date</label>
                  <input type="date" value={formState.schDate || ''} onChange={(e) => setField('schDate', e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border rounded-md" />
                </div>
                <div className="mt-3">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={!!formState.thumbUpdateAvailable}
                      onChange={(e) => setField('thumbUpdateAvailable', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Thumb Update Available</span>
                  </label>
                </div>
                {formState.thumbUpdateAvailable && (
                  <div className="mt-2">
                    <label className="block text-sm text-gray-600">Thumb Status</label>
                    <select
                      value={formState.thumbStatus || 'Pending'}
                      onChange={(e) => setField('thumbStatus', e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border rounded-md"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Existing records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <StudentPaymentsView payments={summary?.student_payments || []} onDelete={onDeletePayment} toDmy={toDmy} />
          {student?.fee_reimbursement === 'YES' && (
            <div className="p-4 bg-white rounded border">
              <h4 className="font-semibold mb-2">Existing Scholarship Proceedings</h4>
              {Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0 ? (
                <div className="space-y-2">
                  {summary.scholarship_proceedings.map((s) => (
                    <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center border rounded p-2">
                      <div className="text-sm truncate">{s.proceeding_no}</div>
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

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
