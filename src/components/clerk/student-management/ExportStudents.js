"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import { branchCodes } from '@/lib/rollNumber';
import { getAssetUrl } from '@/lib/assets';

const ExportStudents = () => {
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
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
      const response = await fetch(`/api/clerk/admission/export-students?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to fetch data');

      if (!data.students || data.students.length === 0) {
        toast.error('No students found for the selected criteria');
        return;
      }

      setPreviewData(data.students);
      toast.success(`Found ${data.students.length} student records.`);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!previewData || previewData.length === 0) {
      toast.error('No data available to export');
      return;
    }
    exportToExcel(previewData, branch, year);
    toast.success(`Successfully exported ${previewData.length} student records.`);
  };

  const maskAadhaar = (value) => {
    if (!value || typeof value !== 'string' || value.length < 4) return 'N/A';
    return `XXXX-XXXX-${value.slice(-4)}`;
  };

  const maskMobile = (value) => {
    if (!value || typeof value !== 'string' || value.length < 5) return 'N/A';
    return `XXXXX${value.slice(-5)}`;
  };

  const isValidImageUrl = (url) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('cloudinary.com');
    } catch {
      return false;
    }
  };

  const exportToExcel = (students, branchCode, batch) => {
    const branchName = branchCodes[branchCode] || branchCode;
    
    // Flatten and format data for Excel
    const worksheetData = students.map(s => ({
      'Roll Number': s.roll_no,
      'Admission Number': s.admission_no,
      'Full Name': s.name,
      'Gender': s.gender,
      'Date of Birth': s.dob,
      'Email': s.email,
      'Mobile Number': s.mobile,
      'Father Name': s.father_name,
      'Mother Name': s.mother_name,
      'Nationality': s.nationality,
      'Religion': s.religion,
      'Category': s.category,
      'Sub-Caste': s.sub_caste,
      'Area Status': s.area_status,
      'Mother Tongue': s.mother_tongue,
      'Place of Birth': s.place_of_birth,
      'Father Occupation': s.father_occupation,
      'Annual Income': s.annual_income,
      'Aadhaar Number': maskAadhaar(s.aadhaar_no),
      'Guardian Mobile': maskMobile(s.guardian_mobile),
      'Permanent Address': s.permanent_address ? s.permanent_address.split(',')[0] : 'N/A',
      'Identification Marks': s.identification_marks,
      'Seat Allotted Category': s.seat_allotted_category,
      'Blood Group': s.blood_group,
      'Fee Reimbursement': s.fee_reimbursement,
      'Qualifying Exam': s.qualifying_exam,
      'SSC Marks': s.ssc_marks,
      'Inter/Diploma Marks': s.inter_marks,
      'Entrance Exam Rank': s.entrance_exam_rank,
      'Previous College': s.previous_college,
      'Photo URL': s.photo ? getAssetUrl(s.photo) : 'N/A',
      'Signature URL': s.signature ? getAssetUrl(s.signature) : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // Styling the header
    const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const address = XLSX.utils.encode_col(col) + '1';
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo-600
        alignment: { horizontal: "center" }
      };
    }

    // Setting column widths
    const columnWidths = [
      { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 40 },
      { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
      { wch: 15 }, { wch: 30 }, { wch: 50 }, { wch: 50 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `KUCET_Students_${branchName}_Batch_${batch}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Configuration Section */}
      <div className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
             </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Student Data Migration</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Filter records and preview before university integration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academic Branch</label>
            <select 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-sm px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all uppercase"
            >
              <option value="">SELECT BRANCH</option>
              {Object.entries(branchCodes).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Admission Batch (4-Year Range)</label>
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-sm px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all uppercase"
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
            className={`w-full md:w-auto h-12 px-8 bg-slate-800 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-3`}
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
        <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden animate-slideUp">
          <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded-sm uppercase tracking-widest">{previewData.length} Records</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Previewing {branchCodes[branch]} Registry for Batch {year}</p>
             </div>
             
             <button 
                onClick={handleExport}
                className="h-10 px-6 bg-green-600 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-sm hover:bg-green-700 transition-all flex items-center gap-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download Excel (Migration Ready)
             </button>
          </div>
          
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b-2 border-slate-100">
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Roll Number</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Full Name</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Aadhaar</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobile</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Photo</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {previewData.map((student, index) => (
                  <tr key={`${student.roll_no}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-black text-slate-700">{student.roll_no}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{student.name}</td>
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-500">{maskAadhaar(student.aadhaar_no)}</td>
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-500">{maskMobile(student.mobile)}</td>
                    <td className="px-6 py-4">
                      {isValidImageUrl(getAssetUrl(student.photo)) ? (
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-100 overflow-hidden bg-slate-100">
                           <Image src={getAssetUrl(student.photo)} width={32} height={32} className="w-full h-full object-cover" alt="S" unoptimized onError={() => {}} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">NA</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {student.signature ? (
                        <div className="h-6 w-16 bg-slate-50 border border-slate-100 p-1 flex items-center justify-center">
                           <Image src={getAssetUrl(student.signature)} width={64} height={24} className="h-full object-contain" alt="SIG" unoptimized />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* 3. Helper Note */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
         <div className="flex gap-3">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
           </svg>
           <div className="space-y-1">
             <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Migration Protocol</p>
             <p className="text-[11px] text-amber-700 leading-relaxed font-medium">Use the preview table to verify student identity and asset presence before generating the master migration file. Photos and Signatures are linked via Cloudinary URLs for seamless remote ingestion.</p>
           </div>
         </div>
      </div>
    </div>
  );
};

export default ExportStudents;
