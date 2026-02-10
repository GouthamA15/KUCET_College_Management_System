"use client";
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import readXlsxFile from 'read-excel-file'; // Corrected import path
import { parseDate } from '@/lib/date';
import { validateRollNo, branchCodes } from '@/lib/rollNumber'; // Import validateRollNo and branchCodes

// --- Constants for Client-Side Validation ---
const HEADERS_MAP = {
  // Required Fields
  roll_no: { display: 'Roll Number', aliases: ['roll no', 'rollnumber', 'registration no', 'admission no', 'hall ticket no', 'studentid', 'h.t no', 'hall ticket number'], required: true },
  name: { display: 'Candidate Name', aliases: ['student name', 'name of the candidate', 'candidate name', 'name of this student'], required: true },
  gender: { display: 'Gender', aliases: ['sex'], required: true },
  date_of_birth: { display: 'Date of Birth', aliases: ['dob'], required: true },
  father_name: { display: 'Father Name', aliases: [], required: true },
  category: { display: 'Category', aliases: ['cast'], required: true },
  address: { display: 'Address', aliases: ['permanent address', 'aadhar card address'], required: true },

  // Optional Fields (students table)
  mobile: { display: 'Mobile', aliases: ['mobile number', 'phone', 'phone number', 'contact number', 'student number'], required: false },
  email: { display: 'Email', aliases: ['email id'], required: false },

  // Optional Fields (student_personal_details table)
  mother_name: { display: 'Mother Name', aliases: [], required: false },
  aadhaar_no: { display: 'Aadhaar No', aliases: ['aadhaar number', 'aadhaar', 'uid', 'aadhar card number'], required: false },
  nationality: { display: 'Nationality', aliases: ['native country'], required: false },
  religion: { display: 'Religion', aliases: [], required: false },
  sub_caste: { display: 'Sub Caste', aliases: [], required: false },
  area_status: { display: 'Area Status', aliases: ['area statu', 'local /non local'], required: false },
  place_of_birth: { display: 'Place of Birth', aliases: [], required: false },
  father_occupation: { display: 'Father Occupation', aliases: ['father work'], required: false },
  annual_income: { display: 'Annual Income', aliases: ['income'], required: false },
  identification_marks: { display: 'Identification Marks', aliases: ['identify marks'], required: false },

  // Optional Fields (student_academic_background table)
  medium_of_instruction: { display: 'Medium of Instruction', aliases: ['medium', 'medium of education', 'language of education', 'education medium'], required: false },
  ranks: { display: 'Ranks', aliases: ['intermediate rank', 'rank'], required: false },
  qualifying_exam: { display: 'Qualifying Exam', aliases: [], required: false },
  previous_college_details: { display: 'Previous College', aliases: [], required: false },

};

const CATEGORIES = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'];
const GENDERS = ['Male', 'Female', 'Other'];
const AREA_STATUSES = ['Local', 'Non-Local'];

// Mobile number regex: 10 digits only or +91 followed by 10 digits
const MOBILE_REGEX = /^(\+91)?\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_REGEX = /^\d+$/;
const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

// --- Utility Functions ---
const normalizeHeader = (header) => {
  if (!header) return '';
  return header.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const validateRow = (rowData, excelRowNumber) => {
  const rowErrors = {};
  const rowWarnings = {};
  const validationErrors = [];

  // --- REQUIRED FIELDS ---
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
    const lowerGender = gender.toLowerCase();
    if (lowerGender === 'm') gender = 'Male';
    if (lowerGender === 'f') gender = 'Female';
  }
  if (!gender || !GENDERS.includes(gender)) {
    rowErrors['gender'] = `Invalid Gender. Must be one of ${GENDERS.join(', ')}.`;
    validationErrors.push({ row: excelRowNumber, field: 'Gender', message: `Invalid Gender: ${gender}` });
  }

  // 4. Date of Birth
  const dobValue = rowData['date_of_birth'];
  if (!dobValue || !parseDate(dobValue)) {
    rowErrors['date_of_birth'] = 'Invalid Date of Birth format.';
    validationErrors.push({ row: excelRowNumber, field: 'Date of Birth', message: `Invalid Date of Birth: ${dobValue}.` });
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
  
  // 7. Address
  const address = String(rowData['address'] || '').trim();
  if (!address) {
    rowErrors['address'] = 'Address is required.';
    validationErrors.push({ row: excelRowNumber, field: 'Address', message: 'Address is required.' });
  }

  // --- OPTIONAL FIELDS ---
  // 8. Mobile Number (Warning for empty, error for invalid)
  const mobile = String(rowData['mobile'] || '').trim();
  if (!mobile) {
    rowWarnings['mobile'] = 'Mobile Number is empty.';
    validationErrors.push({ row: excelRowNumber, field: 'Mobile', message: 'Mobile Number is empty.', isWarning: true });
  } else if (!MOBILE_REGEX.test(mobile)) {
    rowErrors['mobile'] = 'Invalid Mobile Number format (10 digits or +91XXXXXXXXXX).';
    validationErrors.push({ row: excelRowNumber, field: 'Mobile', message: `Invalid Mobile: ${mobile}` });
  }
  
  // 9. Email (Warning for invalid)
  const email = String(rowData['email'] || '').trim();
  if (email && !EMAIL_REGEX.test(email)) {
    rowWarnings['email'] = 'Invalid Email format.';
    validationErrors.push({ row: excelRowNumber, field: 'Email', message: `Invalid Email: ${email}`, isWarning: true });
  }
  
  // 10. Aadhaar (Warning for invalid)
  const aadhaar = String(rowData['aadhaar_no'] || '').replace(/\s/g, '');
  if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
    rowWarnings['aadhaar_no'] = 'Aadhaar should be 12 digits.';
    validationErrors.push({ row: excelRowNumber, field: 'Aadhaar No', message: `Invalid Aadhaar: ${aadhaar}`, isWarning: true });
  }

  // 11. Area Status (Warning for invalid)
  let areaStatus = String(rowData['area_status'] || '').trim();
  if (areaStatus) {
    const lowerArea = areaStatus.toLowerCase();
    if(lowerArea.includes('non')) areaStatus = 'Non-Local';
    else if(lowerArea.includes('local')) areaStatus = 'Local';
  }
  if (areaStatus && !AREA_STATUSES.includes(areaStatus)) {
    rowWarnings['area_status'] = `Invalid Area Status. Must be 'Local' or 'Non-Local'.`;
    validationErrors.push({ row: excelRowNumber, field: 'Area Status', message: `Invalid Area Status: ${areaStatus}`, isWarning: true });
  }

  // 12. Annual Income (Warning for invalid)
  const annualIncome = String(rowData['annual_income'] || '').trim();
  if (annualIncome && !DECIMAL_REGEX.test(annualIncome)) {
    rowWarnings['annual_income'] = 'Annual Income should be a number.';
    validationErrors.push({ row: excelRowNumber, field: 'Annual Income', message: `Invalid Annual Income: ${annualIncome}`, isWarning: true });
  }
  
  // 13. Rank (Warning for invalid)
  const rank = String(rowData['intermediate_rank'] || '').trim();
  if (rank && !NUMBER_REGEX.test(rank)) {
    rowWarnings['intermediate_rank'] = 'Rank should be a number.';
    validationErrors.push({ row: excelRowNumber, field: 'Rank', message: `Invalid Rank: ${rank}`, isWarning: true });
  }

  // Other optional fields (mother_name, nationality, etc.) are treated as free text, so no specific validation is added for them.

  return { rowErrors, rowWarnings, validationErrors };
};


// --- Main Component ---
export default function BulkImportStudents({ onImportSuccess, onReset }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // New state for displaying results from API
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);
  // Import stage management
  const [importStage, setImportStage] = useState('idle'); // idle | header_error | client_preview | importing | success
  const [headerError, setHeaderError] = useState(null); // { missing: [], missingDisplay: [], aliasHints: {}, detectedHeaders: [] }

  // New states for client-side preview and validation
  const [previewData, setPreviewData] = useState(null); // Array of objects (rows)
  const [previewHeaders, setPreviewHeaders] = useState([]); // Array of string (headers)
  const [clientValidationErrors, setClientValidationErrors] = useState([]); // [{ row: 1, message: '...' }]
  const [hasClientValidationErrors, setHasClientValidationErrors] = useState(false); // Only for critical errors
  const [isClientValidated, setIsClientValidated] = useState(false);
  const [isDataEdited, setIsDataEdited] = useState(false);
  const [detectedHeaderMap, setDetectedHeaderMap] = useState({});

  const handleCellEdit = (rowIndex, cellKey, value) => {
    const updatedPreviewData = [...previewData];
    updatedPreviewData[rowIndex][cellKey] = value;
    
    const excelRowNumber = rowIndex + 2;
    const { rowErrors, rowWarnings, validationErrors } = validateRow(updatedPreviewData[rowIndex], excelRowNumber);
    
    updatedPreviewData[rowIndex]._errors = rowErrors;
    updatedPreviewData[rowIndex]._warnings = rowWarnings;

    setPreviewData(updatedPreviewData);
    
    // Update the overall validation errors
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
    setIsDragging(false); // Reset dragging state on drop
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      // Create a synthetic event object for handleFileChange
      const syntheticEvent = {
        target: {
          files: dt.files
        }
      };
      handleFileChange(syntheticEvent); // Reuse the same logic
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
    // Reset all states
    try { toast.dismiss(); } catch {}
    setFile(null);
    setIsLoading(false);
    setShowSummary(false);
    setSummaryData(null);
    setErrorDetails([]);
    setImportStage('idle');
    setHeaderError(null);
    // Reset client-side preview states
    setPreviewData(null);
    setPreviewHeaders([]);
    setClientValidationErrors([]);
    setHasClientValidationErrors(false);
    setIsClientValidated(false);
    setIsDataEdited(false);

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

      const rows = await readXlsxFile(selectedFile);
      if (rows.length < 2) {
        toast.error("File is empty or contains only a header.");
        setImportStage('idle');
        return;
      }

      const rawHeaders = rows[0];
      const detectedHeaderMap = {}; // Maps normalized Excel header -> internal_key
      const missingRequired = [];
      const aliasHints = {};

      // Get a set of all required internal keys
      const requiredKeys = new Set(
        Object.keys(HEADERS_MAP).filter(key => HEADERS_MAP[key].required)
      );

      // Map detected headers to our canonical keys
      const mappedInternalKeys = new Set();
      rawHeaders.forEach(rawHeader => {
        const normalizedExcelHeader = normalizeHeader(rawHeader);
        for (const internalKey in HEADERS_MAP) {
          const headerConfig = HEADERS_MAP[internalKey];
          const allPossibleAliases = [
            internalKey, // e.g., 'roll_no'
            normalizeHeader(headerConfig.display), // e.g., 'roll_number'
            ...headerConfig.aliases.map(normalizeHeader) // e.g., 'hall_ticket_no'
          ];
          
          if (allPossibleAliases.includes(normalizedExcelHeader)) {
            if (!mappedInternalKeys.has(internalKey)) { // Avoid mapping multiple Excel columns to the same internal key
              detectedHeaderMap[normalizedExcelHeader] = internalKey;
              mappedInternalKeys.add(internalKey);
              break; 
            }
          }
        }
      });
      
      // Check for missing *required* headers
      requiredKeys.forEach(key => {
        if (!mappedInternalKeys.has(key)) {
          missingRequired.push(key);
        }
      });

      setDetectedHeaderMap(detectedHeaderMap);

      if (missingRequired.length > 0) {
        const missingDisplay = missingRequired.map(key => {
          const config = HEADERS_MAP[key];
          aliasHints[key] = [config.display, ...config.aliases];
          return { field: key, display: config.display };
        });

        setHeaderError({
          missing: missingRequired,
          missingDisplay,
          aliasHints,
          detectedHeaders: rawHeaders,
        });
        setImportStage('header_error');
        toast.error('Missing required headers. Please check the file.');
        return;
      }

      const dataRows = rows.slice(1);
      const allValidationErrors = [];
      const allPreviewData = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowData = {};
        rawHeaders.forEach((rawHeader, j) => {
            const normalizedExcelHeader = normalizeHeader(rawHeader);
            const internalKey = detectedHeaderMap[normalizedExcelHeader];
            if (internalKey) {
                rowData[internalKey] = row[j];
            }
        });

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
    // Prevent upload if there are critical client-side validation errors
    if (hasClientValidationErrors) {
      toast.error('Cannot import due to critical client-side validation errors. Please fix them first.');
      return;
    }

    try { toast.dismiss(); } catch {}
    setIsLoading(true);
    setImportStage('importing');

    try {
      const response = await fetch('/api/clerk/admission/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: previewData, headers: previewHeaders }),
      });
      const data = await response.json();

      if (response.ok) {
        setSummaryData({
          totalRows: data.totalRows ?? 0,
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          skipped: data.skipped ?? 0,
        });
        const rowErrors = Array.isArray(data.errors) ? data.errors : [];
        setErrorDetails(rowErrors);
        setShowSummary(true);
        if (data.inserted > 0 && rowErrors.length === 0) {
          setImportStage('success');
          toast.success('Students imported successfully');
        } else {
          setImportStage('row_preview');
          toast('Import complete. Please review the results.', { icon: '⚠' });
        }
        if (onImportSuccess) {
          onImportSuccess(data);
        }
      } else {
        const errorMessage = data.error || 'Import failed due to a server issue.';
        toast.error(errorMessage);
        setImportStage('client_preview'); // Revert to preview stage on error
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
    // also clear client-side preview
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
          className={`mx-auto max-w-2xl p-8 border-2 rounded-lg text-center transition cursor-pointer select-none
            ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          <div className="text-3xl mb-2">📄</div>
          <>
              <div className="text-gray-800 font-medium">Drag & drop Excel file here</div>
              <div className="text-gray-600">or click to browse</div>
              <div className="text-xs text-gray-500 mt-2">Accepted: .xlsx, .xls</div>
          </>
        </div>
      )}

      {importStage === 'client_preview' && previewData && (
        <div className="mt-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Data Preview & Validation</h4>
            {(hasClientValidationErrors || clientValidationErrors.some(err => err.isWarning)) && (
              <div className="mb-4 p-3 bg-red-50 rounded-md border border-red-200 text-sm">
                <p className="font-semibold text-red-800">
                  <span className="font-bold">
                    {clientValidationErrors.filter(err => !err.isWarning).length} critical error(s) and{' '}
                    {clientValidationErrors.filter(err => err.isWarning).length} warning(s) found.
                  </span>{' '}
                  Please review the highlighted rows before importing. Critical errors must be fixed, warnings are informational.
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
                          const normalizedHeader = normalizeHeader(header);
                          const internalKey = detectedHeaderMap[normalizedHeader];

                          // If header is not mapped, render a disabled or empty cell
                          if (!internalKey) {
                            return (
                              <td key={colIndex} className="px-1 py-1 whitespace-nowrap text-sm">
                                <input
                                  type="text"
                                  value={""} // Or some indicator for unmapped data
                                  disabled
                                  className="w-full h-full bg-gray-100 border-none p-2 cursor-not-allowed"
                                  title={`Unmapped header: ${header}`}
                                />
                              </td>
                            );
                          }
                          
                          const cellError = row._errors[internalKey];
                          const cellWarning = row._warnings[internalKey];
                          const hasError = !!cellError;
                          const hasWarning = !!cellWarning;

                          return (
                            <td 
                              key={colIndex} 
                              className={`px-1 py-1 whitespace-nowrap text-sm text-gray-700 
                                ${hasError ? 'bg-red-100' : hasWarning ? 'bg-yellow-100' : ''}`}
                            >
                              <input
                                type="text"
                                value={String(row[internalKey] ?? '')}
                                onChange={(e) => handleCellEdit(rowIndex, internalKey, e.target.value)}
                                className={`w-full h-full bg-transparent border-none p-2 focus:ring-1 focus:ring-blue-500 rounded-sm ${
                                  hasError ? 'border-red-300' : hasWarning ? 'border-yellow-300' : ''
                                }`}
                                title={hasError ? cellError : hasWarning ? cellWarning : `Internal Field: ${internalKey}`}
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
            <button
              onClick={handleDismissResults}
              disabled={isLoading}
              className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded shadow hover:bg-gray-300 disabled:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Importing...' : 'Confirm & Import'}
            </button>
          </div>
        </div>
      )}

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
              <span className="font-medium">Updated:</span> {summaryData.updated}
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