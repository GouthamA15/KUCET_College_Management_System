'use client';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

export default function BulkImportStudents({ onImportSuccess }) {
  const [uploadedFile, setUploadedFile] = useState(null);
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
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        toast.error('Invalid file type. Please upload a .xlsx file.');
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setUploadedFile(selectedFile);
    } else {
      setUploadedFile(null);
    }
  };

  const handlePreviewUpload = async () => {
    if (!uploadedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsLoading(true);
    setPreviewData(null);
    setPreviewErrors([]);
    setPreviewMessages([]);
    setShowPreview(false);
    setImportResults(null);
    setShowResults(false);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await fetch('/api/clerk/admission/bulk-import?preview=true', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setPreviewData(data.data);
        setPreviewMessages(data.info || []);
        setShowPreview(true);
        toast.success(data.message || 'Preview generated successfully!');
      } else {
        let errorMessage = data.error || 'An error occurred during preview.';
        if (data.details && Array.isArray(data.details)) {
          setPreviewErrors(data.details);
          const detailsToShow = data.details.slice(0, 3).join('\n');
          errorMessage += `\nDetails:\n${detailsToShow}`;
          if (data.details.length > 3) {
            errorMessage += `\n... and ${data.details.length - 3} more errors.`;
          }
        } else {
            setPreviewErrors([errorMessage]);
        }
        toast.error(errorMessage, { duration: 10000 });
      }
    } catch (error) {
      console.error("Preview upload error:", error);
      toast.error('A network or server error occurred during preview.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadedFile) {
      toast.error('No file selected for import.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', { // No preview=true
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 200 || response.status === 207) { // Handle OK and Multi-Status
        toast.success(data.message || 'Import process finished!');
        setImportResults(data.results);
        setShowResults(true);
        setShowPreview(false); // Hide preview table
        setUploadedFile(null); // Clear file
        if(fileInputRef.current) fileInputRef.current.value = '';
        // Removed: if (onImportSuccess) onImportSuccess();
      } else {
        let errorMessage = data.error || 'An error occurred during import.';
        if (data.details && Array.isArray(data.details)) {
            const detailsToShow = data.details.slice(0, 3).join('\n');
            errorMessage += `\nDetails:\n${detailsToShow}`;
            if (data.details.length > 3) {
                errorMessage += `\n... and ${data.details.length - 3} more errors.`;
            }
        }
        toast.error(errorMessage, { duration: 10000 });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error('A network or server error occurred during import.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Bulk Import Students</h3>

      { !showPreview && !showResults && (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Upload an Excel file (.xlsx) with student data. Ensure the columns match the required format: `roll_no`, `name`, `email` (auto-generated if empty), `mobile`, `date_of_birth`, `father_name`, `mother_name`, `address`, `category`, `gender` (defaults to NULL if empty).
          </p>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
              disabled={isLoading}
            />
            <button
              onClick={handlePreviewUpload}
              disabled={!uploadedFile || isLoading}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Processing...' : 'Preview Data'}
            </button>
          </div>
        </>
      )}

      {showPreview && previewData && (
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-lg font-semibold text-blue-800 mb-4">Preview of Students to be Imported ({previewData.length} records)</h4>
          
          {previewErrors.length > 0 && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
              <p className="font-bold">Errors Found:</p>
              <ul className="list-disc ml-5 text-sm">
                {previewErrors.map((err, idx) => <li key={idx}>{err}</li>)}
              </ul>
            </div>
          )}

          {previewMessages.length > 0 && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
              <p className="font-bold">Information & Warnings:</p>
              <ul className="list-disc ml-5 text-sm">
                {previewMessages.map((msg, idx) => <li key={idx}>{msg}</li>)}
              </ul>
            </div>
          )}

          <div className="max-h-96 overflow-auto border border-gray-300 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {Object.keys(previewData[0] || {}).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((student, index) => (
                  <tr key={index}>
                    {Object.values(student).map((val, idx) => (
                      <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {val !== null && val !== undefined ? String(val) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end mt-6 space-x-3">
            <button
              onClick={() => {
                setUploadedFile(null);
                if(fileInputRef.current) fileInputRef.current.value = '';
                setShowPreview(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={isLoading}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {showResults && importResults && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Import Results</h4>
          <div className="max-h-96 overflow-auto border border-gray-300 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Message</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {importResults.map((result, index) => (
                  <tr key={index} className={result.status === 'success' ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.roll_no}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${result.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      {result.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">{result.errorMessage || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-6">
            <button
                onClick={() => {
                    setShowResults(false);
                    setImportResults(null);
                }}
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-blue-700"
            >
                Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}