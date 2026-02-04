"use client";
import { useState, useRef } from 'react';

export default function BulkImportStudents({ onImportSuccess, onReset }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewErrors, setPreviewErrors] = useState([]);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setPreviewData(null);
    setPreviewErrors([]);
    setPreviewMessages([]);
    setShowPreview(false);
    setImportResults(null);
    setShowResults(false);
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setFile(null);
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
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      const f = dt.files[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!validTypes.includes(f.type)) {
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
      if (onImportSuccess) {
        try { onImportSuccess({ systemError: true, message: 'Please select a file to upload.' }); } catch {}
      }
      return;
    }

    setIsLoading(true);
    if (onReset) { try { onReset(); } catch {} }
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        const total = data.totalRows ?? 0;
        const inserted = data.inserted ?? 0;
        const skipped = data.skipped ?? 0;
        const errors = Array.isArray(data.errors) ? data.errors : [];

        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onImportSuccess) {
          try {
            onImportSuccess({
              summary: { totalRows: total, inserted, skipped },
              errors,
              successCount: inserted,
              errorCount: errors.length,
              errorReportAvailable: errors.length > 0,
            });
          } catch {}
        }
      } else {
        const errors = Array.isArray(data.errors) ? data.errors : [];
        if (onImportSuccess) {
          try {
            onImportSuccess({
              summary: { totalRows: 0, inserted: 0, skipped: 0 },
              errors,
              successCount: 0,
              errorCount: errors.length,
              errorReportAvailable: errors.length > 0,
            });
          } catch {}
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (onImportSuccess) {
        try { onImportSuccess({ systemError: true, message: 'A network or server error occurred.' }); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
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
        onDrop={(e) => { handleDrop(e); setIsDragging(false); }}
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
    </div>
  );
}