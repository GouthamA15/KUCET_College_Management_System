"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import Image from 'next/image';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { getBranchFromRoll, getAdmissionTypeFromRoll, getEntranceExamQualified } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { formatIndianNumber } from '@/lib/financial-utils';
import { getAssetUrl } from '@/lib/assets';

const DatePickerInput = forwardRef(({ value, onClick, ...props }, ref) => (
    <input
      onClick={onClick}
      ref={ref}
      value={value ?? ''}
      {...props}
    />
  ));
DatePickerInput.displayName = 'DatePickerInput';

export default function ViewEditStudent({ fetchedStudent, setFetchedStudent, setActiveAction }) {
  const MAX_MOBILE_LEN = 10;
  const _MAX_ANNUAL_INCOME = 99999999; // match AddNewStudent
  const [editValues, setEditValues] = useState({});
  const [personalFull, setPersonalFull] = useState({});
  const [academicsList, setAcademicsList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [originalEditValues, setOriginalEditValues] = useState(null);
  const [originalPersonalFull, setOriginalPersonalFull] = useState(null);
  const [originalAcademicsList, setOriginalAcademicsList] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [_annualIncomeDisplay, _setAnnualIncomeDisplay] = useState('');
  const [imageLoading, setImageLoading] = useState(true);

  const sanitizeDigits = (input, maxLen = 10) => {
    if (input == null) return '';
    const s = String(input).replace(/\D/g, '');
    return s.slice(0, maxLen);
  };

  useEffect(() => {
    if (fetchedStudent?.pfp) {
      const id = setTimeout(() => setImageLoading(true), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [fetchedStudent?.pfp]);

  useEffect(() => {
    if (!fetchedStudent) return undefined;

    const pd = fetchedStudent.personal_details || {};
    const initialEdit = {
      admission_no: fetchedStudent.admission_no || null,
      roll_no: fetchedStudent.roll_no || null,
      fee_reimbursement: fetchedStudent.fee_reimbursement || null,
      name: fetchedStudent.name || null,
      date_of_birth: formatDate(fetchedStudent.date_of_birth) || null,
      gender: fetchedStudent.gender || 'Male',
      admission_type: getAdmissionTypeFromRoll(fetchedStudent.roll_no) || null,
      course: getBranchFromRoll(fetchedStudent.roll_no) || null,
      mobile: sanitizeDigits(fetchedStudent.mobile || '' , 10) || null,
      email: fetchedStudent.email || null,
      curr_house_no: pd.curr_house_no || null,
      curr_street: pd.curr_street || null,
      curr_apartment: pd.curr_apartment || null,
      curr_city: pd.curr_city || null,
      curr_state: pd.curr_state || null,
      curr_pincode: pd.curr_pincode || null,
      curr_country: pd.curr_country || null,
      perm_house_no: pd.perm_house_no || null,
      perm_street: pd.perm_street || null,
      perm_apartment: pd.perm_apartment || null,
      perm_city: pd.perm_city || null,
      perm_state: pd.perm_state || null,
      perm_pincode: pd.perm_pincode || null,
      perm_country: pd.perm_country || null,
      is_current_same_as_permanent: !!pd.is_current_same_as_permanent,
      father_occupation: pd.father_occupation || null,
      annual_income: pd.annual_income || null,
      admission_date: formatDate(fetchedStudent.admission_date) || null,
      student_status: fetchedStudent.student_status || 'ACTIVE',
      academic_status: fetchedStudent.academic_status || 'ACTIVE',
      academic_offset_years: fetchedStudent.academic_offset_years || 0
    };

    const initialPersonal = {
      father_name: pd.father_name || fetchedStudent.father_name || null,
      mother_name: pd.mother_name || null,
      nationality: pd.nationality || null,
      religion: pd.religion || null,
      category: pd.category || fetchedStudent.category || 'OC',
      sub_caste: pd.sub_caste || null,
      area_status: pd.area_status || 'Local',
      mother_tongue: pd.mother_tongue || null,
      place_of_birth: pd.place_of_birth || null,
      father_occupation: pd.father_occupation || null,
      annual_income: pd.annual_income || null,
      guardian_mobile: pd.guardian_mobile || null,
      aadhaar_no: pd.aadhaar_no || null,
      blood_group: pd.blood_group || null,
      curr_house_no: pd.curr_house_no || null,
      curr_street: pd.curr_street || null,
      curr_apartment: pd.curr_apartment || null,
      curr_city: pd.curr_city || null,
      curr_state: pd.curr_state || null,
      curr_pincode: pd.curr_pincode || null,
      curr_country: pd.curr_country || null,
      perm_house_no: pd.perm_house_no || null,
      perm_street: pd.perm_street || null,
      perm_apartment: pd.perm_apartment || null,
      perm_city: pd.perm_city || null,
      perm_state: pd.perm_state || null,
      perm_pincode: pd.perm_pincode || null,
      perm_country: pd.perm_country || null,
      is_current_same_as_permanent: !!pd.is_current_same_as_permanent,
      seat_allotted_category: pd.seat_allotted_category || null,
      identification_marks: pd.identification_marks || null
    };

    // Copy arrays so we never mutate props.
    let academicsSource = [];
    if (Array.isArray(fetchedStudent.academics)) {
      academicsSource = fetchedStudent.academics;
    } else if (fetchedStudent.academic_background) {
      academicsSource = [fetchedStudent.academic_background];
    }
    const initialAcademics = [...academicsSource];
    let currentQualifyingExam = initialAcademics.length > 0 ? initialAcademics[0].qualifying_exam : '';
    let currentRanks = initialAcademics.length > 0 ? initialAcademics[0].ranks : '';
    let currentSscMarks = initialAcademics.length > 0 ? initialAcademics[0].ssc_marks : '';
    let currentInterMarks = initialAcademics.length > 0 ? initialAcademics[0].inter_marks : '';
    let currentMediumOfInstruction = initialAcademics.length > 0 ? initialAcademics[0].medium_of_instruction : 'English';
    let currentPreviousCollege = initialAcademics.length > 0 ? initialAcademics[0].previous_college_details : '';

    if (!currentQualifyingExam) {
      currentQualifyingExam = getEntranceExamQualified(fetchedStudent.roll_no) || 'TG EAPCET';
    }
    if (initialAcademics.length === 0) {
      initialAcademics.push({ 
        qualifying_exam: currentQualifyingExam, 
        ranks: currentRanks, 
        ssc_marks: currentSscMarks, 
        inter_marks: currentInterMarks,
        medium_of_instruction: currentMediumOfInstruction,
        previous_college_details: currentPreviousCollege
      });
    } else {
      initialAcademics[0] = { 
        ...initialAcademics[0], 
        qualifying_exam: currentQualifyingExam, 
        ranks: currentRanks, 
        ssc_marks: currentSscMarks, 
        inter_marks: currentInterMarks,
        medium_of_instruction: currentMediumOfInstruction,
        previous_college_details: currentPreviousCollege
      };
    }


    const id = setTimeout(() => {
      setEditValues(initialEdit);
      setOriginalEditValues(JSON.parse(JSON.stringify(initialEdit)));

      setPersonalFull(initialPersonal);
      setOriginalPersonalFull(JSON.parse(JSON.stringify(initialPersonal)));

      setAcademicsList(initialAcademics);
      setOriginalAcademicsList(JSON.parse(JSON.stringify(initialAcademics)));

    }, 0);

    return () => clearTimeout(id);
  }, [fetchedStudent]);
  
  const formatAadhaar = (val) => {
    if (val == null) return '';
    const digits = String(val).replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const handleCheckboxChange = (checked) => {
    setPersonalFull(prev => {
      const updated = { ...prev, is_current_same_as_permanent: checked };
      if (checked) {
        updated.perm_house_no = prev.curr_house_no;
        updated.perm_street = prev.curr_street;
        updated.perm_apartment = prev.curr_apartment;
        updated.perm_city = prev.curr_city;
        updated.perm_state = prev.curr_state;
        updated.perm_pincode = prev.curr_pincode;
        updated.perm_country = prev.curr_country;
      }
      return updated;
    });
  };

  const handleAddressChange = (field, value) => {
    setPersonalFull(prev => {
      const updated = { ...prev, [field]: value };
      if (prev.is_current_same_as_permanent && field.startsWith('curr_')) {
        const permField = field.replace('curr_', 'perm_');
        updated[permField] = value;
      }
      return updated;
    });
  };

  const handleSaveEdits = async () => {
    if (!fetchedStudent) return;
    setSaving(true);
    const toastId = toast.loading('Saving changes...');
    try {
      const roll = fetchedStudent.roll_no;
      const updatedData = {
        name: editValues.name,
        admission_no: editValues.admission_no,
        fee_reimbursement: editValues.fee_reimbursement,
        date_of_birth: editValues.date_of_birth,
        gender: editValues.gender,
        mobile: editValues.mobile,
        father_name: personalFull.father_name,
        mother_name: personalFull.mother_name,
        nationality: personalFull.nationality,
        religion: personalFull.religion,
        category: personalFull.category,
        sub_caste: personalFull.sub_caste,
        area_status: personalFull.area_status,
        mother_tongue: personalFull.mother_tongue,
        place_of_birth: personalFull.place_of_birth,
        father_occupation: personalFull.father_occupation,
        annual_income: personalFull.annual_income ? personalFull.annual_income.toString().replace(/,/g, '') : null,
        admission_date: editValues.admission_date,
        student_status: editValues.student_status,
        academic_status: editValues.academic_status,
        academic_offset_years: editValues.academic_offset_years,
        guardian_mobile: personalFull.guardian_mobile,
        aadhaar_no: personalFull.aadhaar_no,
        curr_house_no: personalFull.curr_house_no,
        curr_street: personalFull.curr_street,
        curr_apartment: personalFull.curr_apartment,
        curr_city: personalFull.curr_city,
        curr_state: personalFull.curr_state,
        curr_pincode: personalFull.curr_pincode,
        curr_country: personalFull.curr_country,
        perm_house_no: personalFull.perm_house_no,
        perm_street: personalFull.perm_street,
        perm_apartment: personalFull.perm_apartment,
        perm_city: personalFull.perm_city,
        perm_state: personalFull.perm_state,
        perm_pincode: personalFull.perm_pincode,
        perm_country: personalFull.perm_country,
        is_current_same_as_permanent: !!personalFull.is_current_same_as_permanent,
        seat_allotted_category: personalFull.seat_allotted_category,
        identification_marks: personalFull.identification_marks,
        blood_group: personalFull.blood_group,
        qualifying_exam: academicsList[0]?.qualifying_exam,
        previous_college_details: academicsList[0]?.previous_college_details,
        medium_of_instruction: academicsList[0]?.medium_of_instruction,
        ranks: academicsList[0]?.ranks,
        ssc_marks: academicsList[0]?.ssc_marks,
        inter_marks: academicsList[0]?.inter_marks,
      };

      const res = await fetch(`/api/staff/admission/students/${roll}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student details');
      }
      toast.success('Saved changes successfully', { id: toastId });
      // After successful save, you might want to refetch the data or update the state
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const genders = COLLEGE_CONFIG.genders;
  const categories = COLLEGE_CONFIG.categories;

  const hasEdits = () => {
    try {
      if (!originalEditValues && !originalPersonalFull && !originalAcademicsList) return false;
      if (originalEditValues && JSON.stringify(originalEditValues) !== JSON.stringify(editValues)) return true;
      if (originalPersonalFull && JSON.stringify(originalPersonalFull) !== JSON.stringify(personalFull)) return true;
      if (originalAcademicsList && JSON.stringify(originalAcademicsList) !== JSON.stringify(academicsList)) return true;
      return false;
    } catch (_e) { return false; }
  };

  return (
    <div>
      {!fetchedStudent && <div className="text-gray-600">No student loaded. Use Fetch to load a student.</div>}
      {fetchedStudent && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded border border-blue-100 shadow-sm">
              <h4 className="font-semibold mb-3 text-indigo-700">Profile Sidebar</h4>
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2 ">Profile Photo</div>
                  <div className="w-28 h-28 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center relative border-2 border-indigo-100">
                    {(() => {
                      const p = fetchedStudent.pfp;
                      const has = p && String(p).trim() !== '';
                      const isData = has && String(p).startsWith('data:');
                      const dataHasBody = !isData || (String(p).includes(',') && String(p).split(',')[1].trim() !== '');
                      if (has && dataHasBody) {
                        return (
                            <>
                                {imageLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-1">
                                        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                                        <span className="text-[10px] text-gray-500 font-medium">Loading...</span>
                                    </div>
                                )}
                                <Image 
                                    src={getAssetUrl(String(p))} 
                                    alt="Profile" 
                                    width={112} 
                                    height={112} 
                                    unoptimized
                                    onClick={(e) => { e.stopPropagation(); setImagePreviewSrc(getAssetUrl(String(p))); setImagePreviewOpen(true); }} 
                                    className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                    onLoad={() => setImageLoading(false)}
                                    onError={() => setImageLoading(false)}
                                />
                            </>
                        );
                      }
                      return <div className="text-gray-400 text-xs">No Photo</div>;
                    })()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2 ">Signature</div>
                  <div className="w-32 h-12 bg-white rounded border border-gray-200 overflow-hidden mb-1 flex items-center justify-center">
                    {fetchedStudent.signature ? (
                      <Image
                        src={getAssetUrl(fetchedStudent.signature)}
                        alt="Signature"
                        width={128}
                        height={48}
                        className="max-h-full max-w-full object-contain"
                        onClick={() => { setImagePreviewSrc(getAssetUrl(fetchedStudent.signature)); setImagePreviewOpen(true); }}
                      />
                    ) : (
                      <div className="text-gray-400 text-[10px]">No Signature</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs">
                <div className="font-bold text-gray-800">{fetchedStudent.name}</div>
                <div className="text-gray-600 mt-1">Admission No: {fetchedStudent.admission_no || 'N/A'}</div>
                <div className="text-gray-600">DOB: {formatDate(fetchedStudent.date_of_birth)}</div>
                <div className="text-gray-600">Course: {getBranchFromRoll(fetchedStudent.roll_no) || 'N/A'}</div>
              </div>
            </div>

            <div className="md:col-span-2 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded shadow border border-blue-100">
              <h4 className="font-semibold mb-4 text-indigo-900 border-b pb-2">Section A: Basic Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number</label>
                  <input placeholder="Admission Number" value={editValues.admission_no || ''} onChange={e=>setEditValues({...editValues, admission_no:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                  <div className="relative">
                    <input placeholder="Roll Number" value={editValues.roll_no || ''} disabled className="p-2 border rounded w-full bg-gray-100" />
                    <span title="Roll number cannot be edited" className="absolute right-2 top-2 text-sm">🔒</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                  <input placeholder="Student Name" value={editValues.name || ''} onChange={e=>setEditValues({...editValues, name:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <DatePicker
                    selected={parseDate(editValues.date_of_birth)}
                    onChange={(date) => setEditValues({ ...editValues, date_of_birth: formatDate(date) })}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="DD-MM-YYYY"
                    className="p-2 border rounded w-full"
                    showYearDropdown
                    dropdownMode="select"
                    customInput={<DatePickerInput className="p-2 border rounded w-full" />}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={editValues.gender || 'Male'} onChange={e=>setEditValues({...editValues, gender:e.target.value})} className="p-2 border rounded w-full">
                    {genders.map(g=> <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Reimbursement</label>
                  <select value={editValues.fee_reimbursement || 'NO'} onChange={e=>setEditValues({...editValues, fee_reimbursement: e.target.value})} className="p-2 border rounded w-full">
                    <option value="NO">NO</option>
                    <option value="YES">YES</option>
                    <option value="GOV">GOV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <input placeholder="Course" value={getBranchFromRoll(editValues.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Type</label>
                  <div className="relative">
                    <input placeholder="Admission Type" value={editValues.admission_type || ''} disabled className="p-2 border rounded w-full bg-gray-100" />
                    <span title="Admission Type cannot be changed after admission." className="absolute right-2 top-2 text-sm">🔒</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 border border-r-0 bg-gray-100">+91</span>
                    <input
                      placeholder="Mobile Number"
                      value={editValues.mobile || ''}
                      onChange={e=>{
                        const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, MAX_MOBILE_LEN);
                        setEditValues({...editValues, mobile: digits});
                      }}
                      className="p-2 border rounded w-full"
                      inputMode="numeric"
                      maxLength={MAX_MOBILE_LEN}
                      onPaste={(e) => { const pasted=(e.clipboardData||window.clipboardData).getData('text'); const digits=pasted.replace(/\D/g,'').slice(0, MAX_MOBILE_LEN); setEditValues(prev=>({...prev, mobile: digits})); e.preventDefault(); }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Status</label>
                  <select value={editValues.academic_status || 'ACTIVE'} onChange={e=>setEditValues({...editValues, academic_status:e.target.value})} className="p-2 border rounded w-full">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="GRADUATED">GRADUATED</option>
                    <option value="DETAINED">DETAINED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Offset (Years)</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 border border-r-0 bg-gray-100 text-xs font-bold text-gray-500">OFFSET</span>
                    <input 
                      type="number" 
                      placeholder="Years" 
                      value={editValues.academic_offset_years || 0} 
                      onChange={e=>setEditValues({...editValues, academic_offset_years: parseInt(e.target.value) || 0})} 
                      className="p-2 border rounded w-full rounded-l-none" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date</label>
                  <DatePicker
                    selected={parseDate(editValues.admission_date)}
                    onChange={(date) => setEditValues({ ...editValues, admission_date: formatDate(date) })}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="Admission Date"
                    className="p-2 border rounded w-full"
                    showYearDropdown
                    dropdownMode="select"
                    customInput={<DatePickerInput className="p-2 border rounded w-full" />}
                  />
                </div>
                <div className="col-span-1 md:col-span-3 text-sm text-gray-500 mt-2">
                  Profile Picture is view-only here. Inform Students to Upload their Profile Picture Through Their Student Login.
                </div>
              </div>

              <h4 className="font-semibold mb-4 text-indigo-900 border-b pb-2">Section B: Personal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
                  <input placeholder="Father Name" value={personalFull.father_name || ''} onChange={e=>setPersonalFull({...personalFull, father_name:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother Name</label>
                  <input placeholder="Mother Name" value={personalFull.mother_name || ''} onChange={e=>setPersonalFull({...personalFull, mother_name:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <input placeholder="Nationality" value={personalFull.nationality || ''} onChange={e=>setPersonalFull({...personalFull, nationality:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Religion</label>
                  <select value={personalFull.religion || ''} onChange={e=>setPersonalFull({...personalFull, religion:e.target.value})} className="p-2 border rounded w-full">
                    <option value="">Select Religion</option>
                    {COLLEGE_CONFIG.religions.map(r => (
                        <option key={r} value={r.toUpperCase()}>{r.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={personalFull.category || 'OC'} onChange={e=>setPersonalFull({...personalFull, category:e.target.value})} className="p-2 border rounded w-full">{categories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Caste</label>
                  <input placeholder="Sub Caste" value={personalFull.sub_caste || ''} onChange={e=>setPersonalFull({...personalFull, sub_caste:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area Status</label>
                  <select value={personalFull.area_status || 'Local'} onChange={e=>setPersonalFull({...personalFull, area_status:e.target.value})} className="p-2 border rounded w-full"><option>Local</option><option>Non-Local</option></select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother Tongue</label>
                  <input placeholder="Mother Tongue" value={personalFull.mother_tongue || ''} onChange={e=>setPersonalFull({...personalFull, mother_tongue:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Place of Birth</label>
                  <input placeholder="Place of Birth" value={personalFull.place_of_birth || ''} onChange={e=>setPersonalFull({...personalFull, place_of_birth:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father Occupation</label>
                  <input placeholder="Father Occupation" value={personalFull.father_occupation || ''} onChange={e=>setPersonalFull({...personalFull, father_occupation:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Annual Income</label>
                  <input 
                    placeholder="Annual Income"
                    value={personalFull.annual_income || ''} 
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (raw && parseInt(raw) > 2000000) return;
                      setPersonalFull({...personalFull, annual_income: formatIndianNumber(raw)});
                    }} 
                    className="p-2 border rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Mobile</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 border border-r-0 bg-gray-100 text-sm text-gray-500 font-medium">+91</span>
                    <input
                      placeholder="Guardian Mobile"
                      value={personalFull.guardian_mobile || ''}
                      onChange={(e) => {
                        const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, 10);
                        setPersonalFull({...personalFull, guardian_mobile: digits});
                      }}
                      className="p-2 border rounded rounded-l-none w-full"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                  <input placeholder="Aadhaar Number" value={personalFull.aadhaar_no || ''} onChange={e=>setPersonalFull({...personalFull, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded w-full" maxLength={14} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                  <select value={personalFull.blood_group || ''} onChange={e=>setPersonalFull({...personalFull, blood_group: e.target.value})} className="p-2 border rounded w-full">
                    <option value="">Blood Group (optional)</option>
                    {COLLEGE_CONFIG.bloodGroups.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seat Allotted Category</label>
                  <input placeholder="Seat Allotted Category" value={personalFull.seat_allotted_category || ''} onChange={e=>setPersonalFull({...personalFull, seat_allotted_category:e.target.value})} className="p-2 border rounded w-full" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Identification Marks</label>
                  <textarea placeholder="Identification Marks" value={personalFull.identification_marks || ''} onChange={e=>setPersonalFull({...personalFull, identification_marks:e.target.value})} className="p-2 border rounded w-full h-20 resize-none" />
                </div>
              </div>

              {/* Current Address */}
              <div className="md:col-span-3 border-t border-gray-100 pt-4 mt-2">
                <h4 className="text-sm font-bold text-indigo-900 mb-4">Current Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">House No*</label>
                    <input placeholder="House No*" value={personalFull.curr_house_no || ''} onChange={e => handleAddressChange('curr_house_no', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apartment / Landmark</label>
                    <input placeholder="Apartment / Landmark" value={personalFull.curr_apartment || ''} onChange={e => handleAddressChange('curr_apartment', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street*</label>
                    <input placeholder="Street*" value={personalFull.curr_street || ''} onChange={e => handleAddressChange('curr_street', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                    <input placeholder="City*" value={personalFull.curr_city || ''} onChange={e => handleAddressChange('curr_city', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State*</label>
                    <input placeholder="State*" value={personalFull.curr_state || ''} onChange={e => handleAddressChange('curr_state', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code*</label>
                    <input placeholder="PIN Code*" value={personalFull.curr_pincode || ''} onChange={e => handleAddressChange('curr_pincode', e.target.value.replace(/\D/g, ''))} maxLength={6} className="p-2 border rounded w-full" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country*</label>
                    <input placeholder="Country*" value={personalFull.curr_country || ''} onChange={e => handleAddressChange('curr_country', e.target.value)} className="p-2 border rounded w-full" />
                  </div>
                </div>
              </div>

              {/* Sync Checkbox */}
              <div className="md:col-span-3 flex items-center gap-2 py-4">
                <input 
                  type="checkbox" 
                  id="edit_is_current_same_as_permanent" 
                  checked={!!personalFull.is_current_same_as_permanent} 
                  onChange={e => handleCheckboxChange(e.target.checked)} 
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" 
                />
                <label htmlFor="edit_is_current_same_as_permanent" className="text-sm font-bold text-gray-700 select-none cursor-pointer">
                  Mark as permanent address
                </label>
              </div>

              {/* Permanent Address */}
              <div className="md:col-span-3 border-t border-gray-100 pt-4 mb-4">
                <h4 className="text-sm font-bold text-indigo-900 mb-4">Permanent Address</h4>
                {!personalFull.is_current_same_as_permanent ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">House No*</label>
                      <input placeholder="House No*" value={personalFull.perm_house_no || ''} onChange={e => setPersonalFull({...personalFull, perm_house_no: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apartment / Landmark</label>
                      <input placeholder="Apartment / Landmark" value={personalFull.perm_apartment || ''} onChange={e => setPersonalFull({...personalFull, perm_apartment: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street*</label>
                      <input placeholder="Street*" value={personalFull.perm_street || ''} onChange={e => setPersonalFull({...personalFull, perm_street: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                      <input placeholder="City*" value={personalFull.perm_city || ''} onChange={e => setPersonalFull({...personalFull, perm_city: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State*</label>
                      <input placeholder="State*" value={personalFull.perm_state || ''} onChange={e => setPersonalFull({...personalFull, perm_state: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code*</label>
                      <input placeholder="PIN Code*" value={personalFull.perm_pincode || ''} onChange={e => setPersonalFull({...personalFull, perm_pincode: e.target.value.replace(/\D/g, '')})} maxLength={6} className="p-2 border rounded w-full" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country*</label>
                      <input placeholder="Country*" value={personalFull.perm_country || ''} onChange={e => setPersonalFull({...personalFull, perm_country: e.target.value})} className="p-2 border rounded w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 p-3 rounded tracking-wide">
                    Permanent address is synchronized with current address.
                  </div>
                )}
              </div>
              </div>
            </div>
          <div className="flex justify-end space-x-2">
            <button 
              onClick={() => {
                if (hasEdits() && !window.confirm('You have unsaved changes. Discard changes and clear record?')) return;
                if (setFetchedStudent) setFetchedStudent(null);
                setActiveAction('fetch');
              }} 
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded cursor-pointer hover:bg-red-100 transition text-sm font-medium"
            >
              Clear Record
            </button>
            <button onClick={()=>{ setActiveAction(null); }} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded cursor-pointer hover:bg-gray-200 transition text-sm font-medium">Collapse</button>
              {hasEdits() && (
                <button onClick={handleSaveEdits} disabled={saving} className={`px-4 py-2 bg-[#0b3578] text-white rounded text-sm font-medium ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#082654] hover:shadow-md transition'}`}>{saving? 'Saving...':'Save Changes'}</button>
              )}
          </div>
        </div>
      )}
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}