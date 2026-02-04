'use client';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

export default function BulkImportStudents({ onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        toast.error('Invalid file type. Please upload a .xlsx file.');
        setFile(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Import successful!');
        setFile(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
        if (onImportSuccess) onImportSuccess();
      } else {
        let errorMessage = data.error || 'An error occurred during import.';
        if (data.details && Array.isArray(data.details)) {
          // Displaying a few errors to keep the toast manageable
          const detailsToShow = data.details.slice(0, 3).join('\n'); // Fixed line
          errorMessage += `\nDetails:\n${detailsToShow}`;
          if (data.details.length > 3) {
            errorMessage += `\n... and ${data.details.length - 3} more errors.`;
          }
        }
        toast.error(errorMessage, { duration: 10000 }); // Longer duration for detailed errors
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error('A network or server error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Bulk Import Students</h3>
      <p className="text-sm text-gray-600 mb-4">
        Upload an Excel file (.xlsx) with student data. Ensure the columns match the required format: `roll_no`, `name`, `email`, `mobile`, `date_of_birth`, `father_name`, `mother_name`, `address`, `category`.
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