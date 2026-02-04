"use client";
import { useState, useRef } from 'react';

export default function BulkImportStudents({ onImportSuccess, onReset }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
    formData.append('file', uploadedFile);

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
      <p className="text-sm text-gray-600 mb-4">Upload an Excel file (.xlsx/.xls) with student data.</p>
      <div className="flex items-center space-x-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={isLoading}
        />
        <div onDrop={handleDrop} onDragOver={handleDragOver} className="flex-1 p-3 border-2 border-dashed rounded text-center text-gray-600 hover:bg-gray-50">
          Drag & drop .xlsx/.xls here
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  );
}