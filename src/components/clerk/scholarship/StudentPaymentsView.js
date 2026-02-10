'use client';

export default function StudentPaymentsView({ payments, onDelete, toDmy }) {
  return (
    <div className="p-4 bg-white rounded border">
      <h4 className="font-semibold mb-2">Existing Payments</h4>
      {Array.isArray(payments) && payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded p-2">
              <div className="text-sm">{p.transaction_ref}</div>
              <div className="text-sm">{p.amount}</div>
              <div className="text-sm">{toDmy?.(p.date)}</div>
              <button onClick={() => onDelete?.(p.id)} className="text-red-600 text-xs">Delete</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-600">No payments recorded.</div>
      )}
    </div>
  );
}
