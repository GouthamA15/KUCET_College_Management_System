"use client";

export default function FiltersPopover({ filters, setFilters, onApply, onClear }) {
  const certOptions = [
    { label: 'Bonafide', value: 'Bonafide Certificate' },
    { label: 'Study', value: 'Study Conduct Certificate' },
    { label: 'Migration', value: 'Migration Certificate' },
    { label: 'Transfer (TC)', value: 'Transfer Certificate (TC)' },
  ];
  const statusOptions = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  return (
    <div className="absolute right-0 mt-2 w-full sm:w-80 z-40 left-0 sm:left-auto">
      <div className="bg-white border rounded-md shadow-lg p-3 mx-3 sm:mx-0">
        <h4 className="text-sm font-medium mb-2">Filters</h4>
        <div className="text-sm mb-3">
          <label className="block text-xs text-gray-500 mb-1">Certificate Type</label>
          <select value={filters.certificateType} onChange={(e) => setFilters(f => ({ ...f, certificateType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm">
            <option value="">(Any)</option>
            {certOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="text-sm mb-3">
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm">
            <option value="">(Any)</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClear} className="px-3 py-1 text-sm rounded border">Clear Filters</button>
          <button type="button" onClick={onApply} className="px-3 py-1 text-sm rounded bg-indigo-600 text-white">Apply Filters</button>
        </div>
      </div>
    </div>
  );
}
