"use client";
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import { branchCodes, getBatchFromRoll } from '@/lib/rollNumber';
import { getAssetUrl } from '@/lib/assets';
import { formatDate } from '@/lib/date';
import ImageWithLoading from '@/components/ui/ImageWithLoading';

const ExportStudents = () => {
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Generate admission years as Batches (e.g., 2023 - 2027)
  const currentYear = new Date().getFullYear();
  const batches = [];
  for (let y = currentYear; y >= 2020; y--) {
    batches.push({
      label: `BATCH ${y} - ${y + 4}`,
      value: `${y}-${y + 4}`
    });
  }

  const handleFetch = async () => {
    if (!branch || !year) {
      toast.error('Please select both Branch and Batch');
      return;
    }

    setLoading(true);
    setPreviewData(null);
    try {
      const params = new URLSearchParams({
        branch: branch,
        year: year
      });
      const response = await fetch(`/api/staff/admission/export-students?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to fetch data');

      if (!data.students || data.students.length === 0) {
        toast.error('No students found for the selected criteria');
        return;
      }

      setPreviewData(data.students);
      toast.success(`Found ${data.students.length} student records.`);
    } catch (_error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!previewData || previewData.length === 0) {
      toast.error('No data available to export');
      return;
    }
    const branchName = branchCodes[branch] || branch;
    setExporting(true);
    const toastId = toast.loading('Generating Excel workbook with embedded photographs...');
    try {
      const params = new URLSearchParams({
        branch: branch,
        year: year,
        format: 'excel'
      });
      const response = await fetch(`/api/staff/admission/export-students?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate Excel workbook');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `KUCET_Students_${branchName}_Batch_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success(`Successfully exported ${previewData.length} student records.`, { id: toastId });
    } catch (err) {
      // Fallback to client-side generation if server stream fails
      try {
        exportToExcel(previewData, branch, year);
        toast.success(`Successfully exported ${previewData.length} student records (fallback).`, { id: toastId });
      } catch (_fallbackErr) {
        toast.error(err.message || 'Failed to export Excel workbook', { id: toastId });
      }
    } finally {
      setExporting(false);
    }
  };

  const _isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (clean === '' || clean === 'N/A' || clean === 'NA' || clean === 'None') return false;
    if (clean.startsWith('data:image/')) return true;
    if (clean.startsWith('/api/assets/view/') || clean.startsWith('/assets/')) return true;
    try {
      const urlObj = new URL(clean, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return !!urlObj.pathname;
    } catch {
      return false;
    }
  };

  const sanitizeExcelCell = (val) => {
    if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
      return `'${val}`;
    }
    return val;
  };

  const exportToExcel = (students, branchCode, batch) => {
    const branchName = branchCodes[branchCode] || branchCode;
    
    // Flatten and format data for Excel
    const worksheetData = students.map(s => {
      const dobVal = s.date_of_birth || s.dob;
      return {
        'Roll Number': sanitizeExcelCell(s.roll_no),
        'Admission Number': sanitizeExcelCell(s.admission_no),
        'Batch': sanitizeExcelCell(getBatchFromRoll(s.roll_no) || batch),
        'Full Name': sanitizeExcelCell(s.name),
        'Gender': sanitizeExcelCell(s.gender),
        'Date of Birth': sanitizeExcelCell(dobVal ? formatDate(dobVal, 'N/A') : 'N/A'),
        'Email': sanitizeExcelCell(s.email),
        'Mobile Number': sanitizeExcelCell(s.mobile),
        'Father Name': sanitizeExcelCell(s.father_name),
        'Mother Name': sanitizeExcelCell(s.mother_name),
        'Nationality': sanitizeExcelCell(s.nationality),
        'Religion': sanitizeExcelCell(s.religion),
        'Category': sanitizeExcelCell(s.category),
        'Sub-Caste': sanitizeExcelCell(s.sub_caste),
        'Area Status': sanitizeExcelCell(s.area_status),
        'Mother Tongue': sanitizeExcelCell(s.mother_tongue),
        'Place of Birth': sanitizeExcelCell(s.place_of_birth),
        'Father Occupation': sanitizeExcelCell(s.father_occupation),
        'Annual Income': sanitizeExcelCell(s.annual_income),
        'Aadhaar Number': sanitizeExcelCell(s.aadhaar_no || 'N/A'),
        'APAAR ID': sanitizeExcelCell(s.apaar_id || 'Not Submitted'),
        'Guardian Mobile': sanitizeExcelCell(s.guardian_mobile || 'N/A'),
        'Permanent Address': sanitizeExcelCell(s.permanent_address ? s.permanent_address.split(',')[0] : 'N/A'),
        'Identification Marks': sanitizeExcelCell(s.identification_marks),
        'Seat Allotted Category': sanitizeExcelCell(s.seat_allotted_category),
        'Blood Group': sanitizeExcelCell(s.blood_group || 'Not available'),
        'Fee Reimbursement': sanitizeExcelCell(s.fee_reimbursement),
        'Qualifying Exam': sanitizeExcelCell(s.qualifying_exam),
        'SSC Marks': sanitizeExcelCell(s.ssc_marks),
        'Inter/Diploma Marks': sanitizeExcelCell(s.inter_marks),
        'Entrance Exam Rank': sanitizeExcelCell(s.entrance_exam_rank),
        'Previous College': sanitizeExcelCell(s.previous_college),
        'Photo URL': s.photo ? getAssetUrl(s.photo) : 'N/A',
        'Signature URL': s.signature ? getAssetUrl(s.signature) : 'N/A'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // Styling the header
    const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const address = XLSX.utils.encode_col(col) + '1';
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0B3578" } },
        alignment: { horizontal: "center" }
      };
    }

    // Setting column widths
    const columnWidths = [
      { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
      { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 40 },
      { wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 20 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `KUCET_Students_${branchName}_Batch_${batch}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Configuration Section */}
      <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-3">
          <div className="w-10 h-10 bg-[#0b3578]/10 rounded-full flex items-center justify-center text-[#0b3578]">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
             </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">Student Data Migration</h3>
            <p className="text-sm text-gray-500 mt-0.5">Filter records and preview before university integration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Academic Branch</label>
            <select 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]"
            >
              <option value="">SELECT BRANCH</option>
              {Object.entries(branchCodes).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Admission Batch (4-Year Range)</label>
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]"
            >
              <option value="">SELECT BATCH</option>
              {batches.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-end gap-4">
          <button 
            onClick={handleFetch}
            disabled={loading}
            className={`w-full md:w-auto h-10 px-6 bg-[#0b3578] text-white text-sm font-medium rounded-md hover:bg-[#08295c] transition-all shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Scanning Registry...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <span>Fetch Records</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Preview Section */}
      {previewData && (
        <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden animate-slideUp">
          <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md">{previewData.length} Records</span>
                <p className="text-sm font-medium text-gray-600">Previewing {branchCodes[branch]} Registry for Batch {year}</p>
             </div>
             
             <button 
                onClick={handleExport}
                disabled={exporting}
                className="h-10 px-5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
             >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Generating Excel...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Download Excel</span>
                  </>
                )}
             </button>
          </div>
          
          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 shadow-sm">
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Roll Number</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Batch</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Full Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Mobile</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Photo</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewData.map((student, index) => (
                  <tr key={`${student.roll_no}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-800">{student.roll_no}</td>
                    <td className="px-6 py-3 text-gray-600">{getBatchFromRoll(student.roll_no)}</td>
                    <td className="px-6 py-3 font-medium text-gray-700">{student.name}</td>
                    <td className="px-6 py-3 font-mono text-gray-500 text-xs">{student.mobile || 'N/A'}</td>
                    <td className="px-6 py-3">
                      <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden bg-gray-100">
                        <ImageWithLoading
                          src={student.photo}
                          alt={student.name || "Student"}
                          width={32}
                          height={32}
                          variant="avatar"
                          className="w-full h-full object-cover"
                          emptyText="NA"
                          errorText="NA"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="h-6 w-16 bg-white border border-gray-200 p-0.5 flex items-center justify-center rounded overflow-hidden">
                        <ImageWithLoading
                          src={student.signature}
                          alt="Signature"
                          width={64}
                          height={24}
                          variant="signature"
                          className="h-full object-contain"
                          emptyText="None"
                          errorText="None"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50">
            {previewData.map((student, index) => (
              <div key={`${student.roll_no}-${index}`} className="bg-white border border-gray-200 p-4 rounded-md shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{student.roll_no}</span>
                    <span className="ml-2 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{getBatchFromRoll(student.roll_no)}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden bg-gray-100">
                      <ImageWithLoading
                        src={student.photo}
                        alt={student.name || "Student"}
                        width={32}
                        height={32}
                        variant="avatar"
                        className="w-full h-full object-cover"
                        emptyText="NA"
                        errorText="NA"
                      />
                    </div>
                    {student.signature && (
                      <div className="h-8 w-12 bg-white border border-gray-200 p-0.5 flex items-center justify-center rounded overflow-hidden">
                        <ImageWithLoading
                          src={student.signature}
                          alt="Signature"
                          width={48}
                          height={24}
                          variant="signature"
                          className="h-full object-contain"
                          emptyText="None"
                          errorText="None"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">{student.name}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                    <span className="font-mono">Mobile: {student.mobile || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 3. Helper Note */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-md">
         <div className="flex gap-3">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
           </svg>
           <div className="space-y-1">
             <p className="text-sm font-semibold text-amber-800">Migration Protocol</p>
             <p className="text-sm text-amber-700 leading-relaxed">Use the preview table to verify student identity and asset presence before generating the master migration file. Photos and Signatures are linked via Cloudinary URLs for seamless remote ingestion.</p>
           </div>
         </div>
      </div>
    </div>
  );
};

export default ExportStudents;
