"use client";
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import readXlsxFile from 'read-excel-file';
import { parseDate } from '@/lib/date';
import { validateRollNo } from '@/lib/rollNumber';

// --- Constants for Client-Side Validation ---
const REQUIRED_HEADERS_MAP = {
  roll_no: { display: 'Roll Number', aliases: ['Roll No', 'RollNumber', 'Registration No', 'Admission No', 'Hall Ticket No'] },
  name: { display: 'Candidate Name', aliases: ['Student Name', 'CandidateName'] },
  gender: { display: 'Gender', aliases: [] },
  date_of_birth: { display: 'Date of Birth', aliases: ['DOB', 'DateOfBirth'] },
  father_name: { display: 'Father Name', aliases: ['FatherName'] },
  category: { display: 'Category', aliases: ['Cast'] },
  mobile: { display: 'Mobile', aliases: ['Mobile Number', 'Phone', 'Phone Number', 'Mobile No', 'Phone number', 'mobile number', 'student number', 'number'] },
  aadhaar_no: { display: 'Aadhaar No', aliases: ['Aadhaar Number', 'Aadhaar'] },
  address: { display: 'Address', aliases: ['Permanent Address', 'Full Address'] },
};

const CATEGORIES = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'];
const GENDERS = ['Male', 'Female', 'Other'];

// Mobile number regex: 10 digits only or +91 followed by 10 digits
const MOBILE_REGEX = /^(\+91)?\d{10}$/;

// --- Utility Functions ---
const normalizeHeader = (header) => {
  if (!header) return '';
  return header.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const validateRow = (rowData, excelRowNumber) => {
  const rowErrors = {};
  const rowWarnings = {};
  const validationErrors = [];

  // 1. Roll Number
  const rollNo = String(rowData['roll_no'] || '').trim();
  const { isValid: isRollNoValid } = validateRollNo(rollNo);
  if (!rollNo || !isRollNoValid) {
    rowErrors['roll_no'] = 'Invalid Roll Number format.';
    validationErrors.push({ row: excelRowNumber, field: 'Roll Number', message: `Invalid Roll Number format: ${rollNo}` });
  }

  // 2. Candidate Name
  const candidateName = String(rowData['name'] || '').trim();
  if (!candidateName) {
    rowErrors['name'] = 'Candidate Name is required.';
    validationErrors.push({ row: excelRowNumber, field: 'Candidate Name', message: 'Candidate Name is required.' });
  }

  // 3. Gender
  let gender = String(rowData['gender'] || '').trim();
  if (gender) {
    if (gender.toLowerCase() === 'm') gender = 'Male';
    if (gender.toLowerCase() === 'f') gender = 'Female';
  }
  if (!gender || !GENDERS.includes(gender)) {
    rowErrors['gender'] = `Invalid Gender. Must be one of ${GENDERS.join(', ')}.`;
    validationErrors.push({ row: excelRowNumber, field: 'Gender', message: `Invalid Gender: ${gender}` });
  }

  // 4. Date of Birth
  const dobValue = rowData['date_of_birth'];
  if (!dobValue || !parseDate(dobValue)) {
    rowErrors['date_of_birth'] = 'Invalid Date of Birth format. Expected DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, or MM/DD/YYYY.';
    validationErrors.push({ row: excelRowNumber, field: 'Date of Birth', message: `Invalid Date of Birth: ${dobValue}. Expected formats: DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, MM/DD/YYYY.` });
  }

  // 5. Father Name
  const fatherName = String(rowData['father_name'] || '').trim();
  if (!fatherName) {
    rowErrors['father_name'] = 'Father Name is required.';
    validationErrors.push({ row: excelRowNumber, field: 'Father Name', message: 'Father Name is required.' });
  }

  // 6. Category
  const category = String(rowData['category'] || '').trim().replace(/\s*-\s*/g, '-');
  if (!category || !CATEGORIES.includes(category)) {
    rowErrors['category'] = `Invalid Category. Must be one of ${CATEGORIES.join(', ')}.`;
    validationErrors.push({ row: excelRowNumber, field: 'Category', message: `Invalid Category: ${category}` });
  }

  // 7. Mobile Number
  const mobile = String(rowData['mobile'] || '').trim();
  if (!mobile) {
    rowWarnings['mobile'] = 'Mobile Number is empty.';
    validationErrors.push({ row: excelRowNumber, field: 'Mobile', message: 'Mobile Number is empty.', isWarning: true });
  } else if (!MOBILE_REGEX.test(mobile)) {
    rowErrors['mobile'] = 'Invalid Mobile Number format (10 digits or +91 followed by 10 digits).';
    validationErrors.push({ row: excelRowNumber, field: 'Mobile', message: `Invalid Mobile: ${mobile}` });
  }

  // 8. Address (Warning for empty)
  const address = String(rowData['address'] || '').trim();
  if (!address) {
    rowWarnings['address'] = 'Address is empty.';
    validationErrors.push({ row: excelRowNumber, field: 'Address', message: 'Address is empty.', isWarning: true });
  }

  return { rowErrors, rowWarnings, validationErrors };
};

// --- Main Component ---
export default function BulkImportStudents({ onImportSuccess, onReset }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // State for API results
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);
  
  // Import stage management
  const [importStage, setImportStage] = useState('idle');
  const [headerError, setHeaderError] = useState(null);

  // States for client-side preview and validation
  const [previewData, setPreviewData] = useState(null);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [headerMapping, setHeaderMapping] = useState([]); // New state
  const [clientValidationErrors, setClientValidationErrors] = useState([]);
  const [hasClientValidationErrors, setHasClientValidationErrors] = useState(false);
  const [isClientValidated, setIsClientValidated] = useState(false);
  const [isDataEdited, setIsDataEdited] = useState(false);

  const handleCellEdit = (rowIndex, cellKey, value) => {
    const updatedPreviewData = [...previewData];
    updatedPreviewData[rowIndex][cellKey] = value;
    
    const excelRowNumber = rowIndex + 2;
    const { rowErrors, rowWarnings, validationErrors } = validateRow(updatedPreviewData[rowIndex], excelRowNumber);
    
    updatedPreviewData[rowIndex]._errors = rowErrors;
    updatedPreviewData[rowIndex]._warnings = rowWarnings;

    setPreviewData(updatedPreviewData);
    
    const otherRowsErrors = clientValidationErrors.filter(err => err.row !== excelRowNumber);
    const newValidationErrors = [...otherRowsErrors, ...validationErrors];
    setClientValidationErrors(newValidationErrors);
    
    const criticalErrors = newValidationErrors.filter(err => !err.isWarning);
    setHasClientValidationErrors(criticalErrors.length > 0);
    setIsDataEdited(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      handleFileChange({ target: { files: dt.files } });
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

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    try { toast.dismiss(); } catch {}
    setFile(null);
    setIsLoading(false);
    setShowSummary(false);
    setSummaryData(null);
    setErrorDetails([]);
    setImportStage('idle');
    setHeaderError(null);
    setPreviewData(null);
    setPreviewHeaders([]);
    setHeaderMapping([]);
    setClientValidationErrors([]);
    setHasClientValidationErrors(false);
    setIsClientValidated(false);
    setIsDataEdited(false);

    if (selectedFile) {
      if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(selectedFile.type)) {
        toast.error("Invalid file type. Please upload an Excel file (.xlsx or .xls).");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFile(selectedFile);
      if (onReset) { try { onReset(); } catch {} }

      const rows = await readXlsxFile(selectedFile);
      if (rows.length < 2) {
        toast.error("File is empty or contains only a header.");
        setImportStage('idle');
        return;
      }

      const rawHeaders = rows[0];
      
      const canonicalMap = {};
      for (const canonicalKey in REQUIRED_HEADERS_MAP) {
        const { aliases, display } = REQUIRED_HEADERS_MAP[canonicalKey];
        const allAliases = [display, ...aliases].map(normalizeHeader);
        allAliases.forEach(alias => {
          if(alias) canonicalMap[alias] = canonicalKey;
        });
        canonicalMap[canonicalKey] = canonicalKey;
      }

      const mapping = rawHeaders.map(h => canonicalMap[normalizeHeader(h)] || normalizeHeader(h));
      setHeaderMapping(mapping);

      const dataRows = rows.slice(1);
      const allValidationErrors = [];
      const allPreviewData = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowData = {};
        for (let j = 0; j < mapping.length; j++) {
          const key = mapping[j];
          rowData[key] = row[j];
        }

        const excelRowNumber = i + 2;
        const { rowErrors, rowWarnings, validationErrors } = validateRow(rowData, excelRowNumber);
        
        allPreviewData.push({ ...rowData, _errors: rowErrors, _warnings: rowWarnings });
        allValidationErrors.push(...validationErrors);
      }

      const criticalErrors = allValidationErrors.filter(err => !err.isWarning);
      const warnings = allValidationErrors.filter(err => err.isWarning);

      setPreviewHeaders(rawHeaders);
      setPreviewData(allPreviewData);
      setClientValidationErrors(allValidationErrors);
      setHasClientValidationErrors(criticalErrors.length > 0);
      setIsClientValidated(true);
      setImportStage('client_preview');

      if (criticalErrors.length > 0) {
        toast(`File has ${criticalErrors.length} critical error(s). Please fix before importing.`, { icon: '❌' });
      } else if (warnings.length > 0) {
        toast(`File has ${warnings.length} warning(s). Please review.`, { icon: '⚠️' });
      } else {
        toast.success('File ready for import. Review the preview.');
      }
    }
  };

  const handleUpload = async () => {
    if (!previewData) {
      toast.error('No data to import.');
      return;
    }
    if (hasClientValidationErrors) {
      toast.error('Cannot import due to critical client-side validation errors. Please fix them first.');
      return;
    }

    try { toast.dismiss(); } catch {}
    setIsLoading(true);
    setImportStage('importing');

    // Transform data back to a format the server expects (keys as normalized headers)
    const dataToSend = previewData.map(rowWithCanonicalKeys => {
      const serverRow = {};
      previewHeaders.forEach((header, index) => {
        const normalizedHeader = normalizeHeader(header);
        const canonicalKey = headerMapping[index];
        if (canonicalKey && rowWithCanonicalKeys.hasOwnProperty(canonicalKey)) {
          serverRow[normalizedHeader] = rowWithCanonicalKeys[canonicalKey];
        } else {
           // For unmapped columns, just pass them as-is
           serverRow[normalizedHeader] = rowWithCanonicalKeys[normalizedHeader];
        }
      });
      return serverRow;
    });

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: dataToSend, headers: previewHeaders }),
      });
      const data = await response.json();

      if (response.ok) {
        setSummaryData({
          totalRows: data.totalRows ?? 0,
          inserted: data.inserted ?? 0,
          skipped: data.skipped ?? 0,
        });
        const rowErrors = Array.isArray(data.errors) ? data.errors : [];
        setErrorDetails(rowErrors);
        setShowSummary(true);
        setImportStage(rowErrors.length > 0 ? 'row_preview' : 'success');
        if (data.inserted > 0 && rowErrors.length === 0) {
          toast.success('Students imported successfully');
        } else {
          toast('Import complete. Please review the results.', { icon: '⚠' });
        }
        if (onImportSuccess) onImportSuccess(data);
      } else {
        const errorMessage = data.error || 'Import failed due to a server issue.';
        toast.error(errorMessage);
        setImportStage('client_preview');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Import failed due to a network or server error.');
      setImportStage('client_preview');
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
    setFile(null);
    setPreviewData(null);
    setPreviewHeaders([]);
    setClientValidationErrors([]);
    setHasClientValidationErrors(false);
    setIsClientValidated(false);
    if(fileInputRef.current) fileInputRef.current.value = '';
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

      {importStage === 'idle' && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`mx-auto max-w-2xl p-8 border-2 rounded-lg text-center transition cursor-pointer select-none ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          <div className="text-3xl mb-2">📄</div>
          <div className="text-gray-800 font-medium">Drag & drop Excel file here</div>
          <div className="text-gray-600">or click to browse</div>
          <div className="text-xs text-gray-500 mt-2">Accepted: .xlsx, .xls</div>
        </div>
      )}

      {importStage === 'client_preview' && previewData && (
        <div className="mt-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Data Preview & Validation</h4>
            {(hasClientValidationErrors || clientValidationErrors.some(err => err.isWarning)) && (
              <div className="mb-4 p-3 bg-red-50 rounded-md border border-red-200 text-sm">
                <p className="font-semibold text-red-800">
                  <span className="font-bold">{clientValidationErrors.filter(err => !err.isWarning).length} critical error(s) and {clientValidationErrors.filter(err => err.isWarning).length} warning(s) found.</span> Please review the highlighted rows before importing. Critical errors must be fixed, warnings are informational.
                </p>
              </div>
            )}
            {!hasClientValidationErrors && clientValidationErrors.some(err => err.isWarning) && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200 text-sm">
                    <p className="font-semibold text-yellow-800">
                        <span className="font-bold">{clientValidationErrors.filter(err => err.isWarning).length} warning(s) found.</span> Please review.
                    </p>
                </div>
            )}
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                    {previewHeaders.map((header, index) => (
                      <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, rowIndex) => {
                    const hasRowErrors = Object.keys(row._errors).length > 0;
                    const hasRowWarnings = Object.keys(row._warnings).length > 0;
                    const rowStateClass = hasRowErrors ? 'bg-red-50' : hasRowWarnings ? 'bg-yellow-50' : '';

                    return (
                      <tr key={rowIndex} className={rowStateClass}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{rowIndex + 2}</td>
                        {previewHeaders.map((header, colIndex) => {
                          const cellKey = headerMapping[colIndex];
                          const cellError = row._errors[cellKey];
                          const cellWarning = row._warnings[cellKey];
                          const hasError = !!cellError;
                          const hasWarning = !!cellWarning;
                          return (
                            <td key={colIndex} className={`px-1 py-1 whitespace-nowrap text-sm text-gray-700 ${hasError ? 'bg-red-100' : hasWarning ? 'bg-yellow-100' : ''}`}>
                              <input
                                type="text"
                                value={String(row[cellKey] ?? '')}
                                onChange={(e) => handleCellEdit(rowIndex, cellKey, e.target.value)}
                                className={`w-full h-full bg-transparent border-none p-2 focus:ring-1 focus:ring-blue-500 rounded-sm ${hasError ? 'border-red-300' : hasWarning ? 'border-yellow-300' : ''}`}
                                title={hasError ? cellError : hasWarning ? cellWarning : ''}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <button onClick={handleDismissResults} disabled={isLoading} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded shadow hover:bg-gray-300 disabled:bg-gray-400">Cancel</button>
            <button onClick={handleUpload} disabled={!file || isLoading || hasClientValidationErrors} className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {isLoading ? 'Importing...' : 'Confirm & Import'}
            </button>
          </div>
        </div>
      )}

      {importStage === 'header_error' && headerError && (
        <div className="mt-8 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-red-800">Import blocked due to missing required headers</h4>
            <button onClick={handleDismissResults} className="px-3 py-1 text-sm bg-red-200 hover:bg-red-300 rounded-md text-red-800">Dismiss</button>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <h5 className="font-semibold text-red-700 mb-2">Missing headers</h5>
              <ul className="list-disc list-inside space-y-1">
                {headerError.missingDisplay?.map((m, idx) => (
                    <li key={idx} className="text-gray-800">
                      <span className="font-medium">{m.display}</span>
                      {headerError.aliasHints?.[m.field]?.length > 0 && (
                        <span className="text-gray-600"> (aliases: {headerError.aliasHints[m.field].join(', ')})</span>
                      )}
                    </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-gray-700 mb-2">Detected headers</h5>
              <ul className="list-disc list-inside space-y-1">
                {headerError.detectedHeaders?.map((h, idx) => (
                  <li key={idx} className="text-gray-800">{h || '(empty)'}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showSummary && summaryData && (importStage === 'row_preview' || importStage === 'success') && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-gray-800">Import Results</h4>
            <button onClick={handleDismissResults} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700">Dismiss</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-700">
            <div><span className="font-medium">Total Rows:</span> {summaryData.totalRows}</div>
            <div><span className="font-medium">Inserted:</span> {summaryData.inserted}</div>
            <div><span className="font-medium">Skipped:</span> {summaryData.skipped}</div>
          </div>

          {importStage === 'row_preview' && errorDetails.length > 0 && (
            <div className="mt-6">
              <h5 className="text-md font-semibold text-red-700 mb-3"><span className="text-red-500 mr-2">⚠</span> Row-level validation errors</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Excel Row</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {errorDetails.map((error, index) => (
                      <tr key={index} className="hover:bg-red-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{error.row}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{error.roll_no || 'N/A'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{error.reason}</td>
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