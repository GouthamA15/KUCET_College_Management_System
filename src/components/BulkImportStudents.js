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
  // Import stage management
  const [importStage, setImportStage] = useState('idle'); // idle | header_error | row_preview | importing | success
  const [headerError, setHeaderError] = useState(null); // { missing: [], missingDisplay: [], aliasHints: {}, detectedHeaders: [] }


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    // Reset all states
    try { toast.dismiss(); } catch {}
    setFile(null);
    setIsLoading(false);
    setShowSummary(false);
    setSummaryData(null);
    setErrorDetails([]);
    setImportStage('idle');
    setHeaderError(null);

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

    try { toast.dismiss(); } catch {}
    setIsLoading(true);
    setImportStage('importing');
    setShowSummary(false); // Hide previous summary
    setSummaryData(null);
    setErrorDetails([]);
    setHeaderError(null);

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
        const rowErrors = Array.isArray(data.errors) ? data.errors : [];
        setErrorDetails(rowErrors);
        const insertedCount = Number(data.inserted || 0);
        const errorCount = rowErrors.length;
        setShowSummary(true);
        if (insertedCount > 0 && errorCount === 0) {
          setImportStage('success');
          toast.success('Students imported successfully');
        } else if (insertedCount === 0 && errorCount > 0) {
          setImportStage('row_preview');
          toast('Import failed. Please review the errors below.', { icon: '⚠' });
        } else {
          // Partial success (some rows failed)
          setImportStage('row_preview');
          toast('Some rows failed. Review details below.', { icon: '⚠' });
        }

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
        // Distinguish HEADER_ERRORS from other API errors
        if (data && data.type === 'HEADER_ERRORS') {
          setHeaderError({
            missing: Array.isArray(data.missingRequired) ? data.missingRequired : [],
            missingDisplay: Array.isArray(data.missingDisplayNames) ? data.missingDisplayNames : [],
            aliasHints: data.aliasHints || {},
            detectedHeaders: Array.isArray(data.detectedHeaders) ? data.detectedHeaders : [],
          });
          setImportStage('header_error');
          setShowSummary(false);
          setSummaryData(null);
          setErrorDetails([]);
          toast('Import blocked. Please fix the highlighted issues below.', { icon: '⚠' });
          // Notify consumer without misleading counts
          if (onImportSuccess) {
            try {
              onImportSuccess({ headerError: true, missingRequired: data.missingRequired, detectedHeaders: data.detectedHeaders });
            } catch (e) {
              console.error('Error in onImportSuccess callback (header error)', e);
            }
          }
        } else {
          // Generic API error
          const errorMessage = data.error || 'Import failed due to a server issue. Please try again.';
          toast.error(errorMessage);
          setImportStage('idle');
          setShowSummary(false);
          setSummaryData(null);
          setErrorDetails([]);
          if (onImportSuccess) {
            try {
              onImportSuccess({ systemError: true, message: errorMessage });
            } catch (e) {
              console.error('Error in onImportSuccess callback (API error)', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Import failed due to a network or server error.');
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
    setHeaderError(null);
    setImportStage('idle');
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

      {importStage === 'header_error' && headerError && (
        <div className="mt-8 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-red-800">Import blocked due to missing required headers</h4>
            <button
              onClick={handleDismissResults}
              className="px-3 py-1 text-sm bg-red-200 hover:bg-red-300 rounded-md text-red-800"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <h5 className="font-semibold text-red-700 mb-2">Missing headers</h5>
              <ul className="list-disc list-inside space-y-1">
                {headerError.missingDisplay && headerError.missingDisplay.length > 0 ? (
                  headerError.missingDisplay.map((m, idx) => (
                    <li key={idx} className="text-gray-800">
                      <span className="font-medium">{m.display}</span>
                      {headerError.aliasHints && headerError.aliasHints[m.field] && headerError.aliasHints[m.field].length > 0 && (
                        <span className="text-gray-600"> {' '} (expected aliases: {headerError.aliasHints[m.field].join(', ')})</span>
                      )}
                    </li>
                  ))
                ) : (
                  headerError.missing.map((field, idx) => (
                    <li key={idx} className="text-gray-800">{field}</li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-gray-700 mb-2">Detected headers</h5>
              <ul className="list-disc list-inside space-y-1">
                {headerError.detectedHeaders && headerError.detectedHeaders.length > 0 ? (
                  headerError.detectedHeaders.map((h, idx) => (
                    <li key={idx} className="text-gray-800">{h || '(empty)'}</li>
                  ))
                ) : (
                  <li className="text-gray-600">No headers detected.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showSummary && summaryData && (importStage === 'row_preview' || importStage === 'success') && (
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

          {importStage === 'row_preview' && errorDetails.length > 0 && (
            <div className="mt-6">
              <h5 className="text-md font-semibold text-red-700 mb-3">
                <span className="text-red-500 mr-2">⚠</span> Row-level validation errors
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