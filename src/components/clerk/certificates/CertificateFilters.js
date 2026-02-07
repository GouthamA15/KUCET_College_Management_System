"use client";

export default function CertificateFilters() {
  return (
    <div className="w-full bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Filters</h3>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Certificate Type:</span>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Bonafide</span>
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Study</span>
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Migration</span>
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Conduct</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Pending</span>
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Approved</span>
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">Rejected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
