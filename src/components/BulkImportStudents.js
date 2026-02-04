"use client";
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

export default function BulkImportStudents({ onImportSuccess, onReset }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // New state for displaying results
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    // Reset all states
    setFile(null);
    setIsLoading(false);
    setShowSummary(false);
    setSummaryData(null);
    setErrorDetails([]);

    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Invalid file type. Please upload an Excel file (.xlsx or .xls).");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFile(selectedFile);
      if (onReset) { try { onReset(); } catch {} }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false); // Reset dragging state on drop
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      const f = dt.files[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!validTypes.includes(f.type)) {
        toast.error("Invalid file type. Please upload an Excel file (.xlsx or .xls).");
        return;
      }
      setFile(f);
      if (fileInputRef.current) fileInputRef.current.files = dt.files;
      if (onReset) { try { onReset(); } catch {} }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsLoading(true);
    setShowSummary(false); // Hide previous summary
    setSummaryData(null);
    setErrorDetails([]);

    if (onReset) { try { onReset(); } catch {} }
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        setSummaryData({
          totalRows: data.totalRows ?? 0,
          inserted: data.inserted ?? 0,
          skipped: data.skipped ?? 0,
        });
        setErrorDetails(Array.isArray(data.errors) ? data.errors : []);
        setShowSummary(true);
        toast.success(`Import completed: ${data.inserted} inserted, ${data.errors.length} errors.`);

        setFile(null); // Clear file input after successful import attempt
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onImportSuccess) {
          try {
            onImportSuccess({
              summary: { totalRows: data.totalRows, inserted: data.inserted, skipped: data.skipped },
              errors: data.errors,
              successCount: data.inserted,
              errorCount: data.errors.length,
            });
          } catch (e) {
            console.error("Error in onImportSuccess callback", e);
          }
        }
      } else {
        // API returned an error status (e.g., 400, 500)
        const errorMessage = data.error || 'Failed to import students.';
        toast.error(errorMessage);
        setErrorDetails(Array.isArray(data.errors) ? data.errors : []);
        setShowSummary(true); // Still show summary to display errors if they exist

        setSummaryData({ // Provide some default summary for error cases
            totalRows: 0,
            inserted: 0,
            skipped: 0
        });

        if (onImportSuccess) {
            try {
                onImportSuccess({
                    summary: { totalRows: 0, inserted: 0, skipped: 0 },
                    errors: data.errors || [],
                    successCount: 0,
                    errorCount: (data.errors || []).length,
                });
            } catch (e) {
                console.error("Error in onImportSuccess callback (API error)", e);
            }
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('A network or server error occurred.');
      setShowSummary(false); // Hide summary if network error
      setSummaryData(null);
      setErrorDetails([]);
      if (onImportSuccess) {
        try { onImportSuccess({ systemError: true, message: 'A network or server error occurred.' }); } catch (e) {
            console.error("Error in onImportSuccess callback (network error)", e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissResults = () => {
    setShowSummary(false);
    setSummaryData(null);
    setErrorDetails([]);
  };


  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Bulk Import Students</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="sr-only"
        disabled={isLoading}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`mx-auto max-w-2xl p-8 border-2 rounded-lg text-center transition cursor-pointer select-none
          ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
      >
        <div className="text-3xl mb-2">📄</div>
        {!file ? (
          <>
            <div className="text-gray-800 font-medium">Drag & drop Excel file here</div>
            <div className="text-gray-600">or click to browse</div>
            <div className="text-xs text-gray-500 mt-2">Accepted: .xlsx, .xls</div>
          </>
        ) : (
          <>
            <div className="text-gray-800 font-medium">Selected file: {file.name}</div>
            <div className="text-xs text-gray-500 mt-2">Accepted: .xlsx, .xls</div>
          </>
        )}
        <div className="mt-6">
          <button
            onClick={(e) => { e.stopPropagation(); handleUpload(); }}
            disabled={!file || isLoading}
            className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Importing...' : 'Import Students'}
          </button>
        </div>
      </div>

      {showSummary && summaryData && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-gray-800">Import Results</h4>
            <button
              onClick={handleDismissResults}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-700">
            <div>
              <span className="font-medium">Total Rows:</span> {summaryData.totalRows}
            </div>
            <div>
              <span className="font-medium">Inserted:</span> {summaryData.inserted}
            </div>
            <div>
              <span className="font-medium">Skipped (due to errors):</span> {summaryData.skipped}
            </div>
          </div>

          {errorDetails.length > 0 && (
            <div className="mt-6">
              <h5 className="text-md font-semibold text-red-700 mb-3">
                <span className="text-red-500 mr-2">⚠</span> Encountered {errorDetails.length} errors:
              </h5>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Excel Row
                      </th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll Number
                      </th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {errorDetails.map((error, index) => (
                      <tr key={index} className="hover:bg-red-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {error.row}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {error.roll_no || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {error.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}