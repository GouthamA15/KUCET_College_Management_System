"use client";
import { formatCertificateName } from '@/lib/certificate-utils';
import { FileText, ArrowUpDown } from 'lucide-react';

export default function CertificateRecordsView({ records = [], onViewDetails, loading = false }) {

  const formatDateForDisplay = (val) => {
    if (!val && val !== 0) return '-';
    try {
      const s = String(val);
      const datePart = s.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        return `${d}-${m}-${y}`;
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
      return s;
    } catch {
      return String(val);
    }
  };

  const statusClass = (s) => {
    const st = String(s || '').toUpperCase();
    if (st === 'APPROVED') return 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (st === 'REJECTED') return 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200';
    if (st === 'PENDING') return 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200';
    return 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200';
  };

  if (loading && records.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
            <p className="text-sm font-medium text-center text-gray-500">Connecting to Records Office...</p>
        </div>
    );
  }

  if (records.length === 0) {
    return (
        <div className="bg-white border border-gray-200 shadow-sm py-24 text-center rounded-lg flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">No Records Found</h2>
          <p className="text-sm text-gray-500 mt-2">There are no certificate requests in this view.</p>
        </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-6 py-4 whitespace-nowrap">Roll Number</th>
              <th className="px-6 py-4 whitespace-nowrap">Student Name</th>
              <th className="px-6 py-4 whitespace-nowrap">Certificate Type</th>
              <th className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
                  Date <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Status</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((r, i) => (
              <tr key={r.request_id ?? i} className="hover:bg-blue-50/50 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono text-gray-800">{r.roll_number ?? r.roll}</span>
                    {r.is_flagged && (
                      <span className="text-rose-500 animate-pulse" title="Flagged: Duplicate Proof Detected">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-700">{r.student_name || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-700">{formatCertificateName(r.certificate_type ?? r.type, r.purpose)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-700">{formatDateForDisplay(r.date)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={statusClass(r.status)}>{r.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md bg-[#0b3578] text-white hover:bg-blue-900 text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                    onClick={() => onViewDetails && onViewDetails(r)}
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
  );
}
