"use client";

export default function CertificateRecordsView({ records = [], onViewDetails, groupByDate = false, loading = false }) {

  const formatDateForDisplay = (val) => {
    if (!val && val !== 0) return '-';
    try {
      const s = String(val);
      // prefer date portion before 'T' if present
      const datePart = s.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        return `${d}-${m}-${y}`;
      }
      // already DD-MM-YYYY
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
      return s;
    } catch {
      return String(val);
    }
  };

  const statusClass = (s) => {
    const st = String(s || '').toUpperCase();
    if (st === 'APPROVED') return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800';
    if (st === 'REJECTED') return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700';
    if (st === 'PENDING') return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800';
    return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700';
  };

  // If grouping is requested, group records by date (YYYY-MM-DD -> DD-MM-YYYY display)
  if (groupByDate) {
    const groups = {};
    records.forEach(r => {
      const d = r.date ? String(r.date).split('T')[0] : (r.completed_at ? String(r.completed_at).split('T')[0] : null);
      const key = d || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    // Sort group keys descending (latest first)
    const sortedKeys = Object.keys(groups).sort((a, b) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)));

    // If loading, show centered spinner and text while keeping card/frame
    if (loading) {
      return (
        <section className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Certificate Records</h3>
          </div>
          <div className="p-6 flex items-center justify-center" style={{ minHeight: 220 }}>
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-indigo-600 rounded-full" />
              <div className="text-sm text-gray-600">Loading history...</div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Certificate Records</h3>
        </div>
        <div className="p-4 space-y-6">
          {sortedKeys.map((k) => (
            <div key={k} className="">
              <div className="mb-2 font-semibold text-gray-800">{formatDateForDisplay(k)}</div>
              <div className="overflow-x-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">View Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groups[k].map((r, i) => (
                      <tr key={r.request_id ?? i}>
                        <td className="px-6 py-3 text-sm text-gray-800">{r.roll_number ?? r.roll}</td>
                        <td className="px-6 py-3 text-sm text-gray-800">{r.certificate_type ?? r.type}</td>
                        <td className="px-6 py-3 text-sm">
                          <span className={statusClass(r.status)}>{r.status}</span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-800">{formatDateForDisplay(r.date)}</td>
                        <td className="px-6 py-3 text-sm">
                          <button
                            type="button"
                            className="px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                            onClick={() => onViewDetails && onViewDetails(r)}
                            title="View details"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Certificate Records</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">View Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td className="px-6 py-12 text-center text-gray-600" colSpan={5}>
                  <div className="flex flex-col items-center">
                    <div className="animate-spin h-7 w-7 border-4 border-t-transparent border-indigo-600 rounded-full" />
                    <div className="mt-2 text-sm">Loading history...</div>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={r.request_id ?? i}>
                  <td className="px-6 py-3 text-sm text-gray-800">{r.roll_number ?? r.roll}</td>
                  <td className="px-6 py-3 text-sm text-gray-800">{r.certificate_type ?? r.type}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={statusClass(r.status)}>{r.status}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">{formatDateForDisplay(r.date)}</td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                      onClick={() => onViewDetails && onViewDetails(r)}
                      title="View details"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
