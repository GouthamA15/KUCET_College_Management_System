"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { validateRollNo, getBranchFromRoll, getAdmissionTypeFromRoll, getEntranceExamQualified } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { smoothScrollToTop } from '@/lib/scroll-utils';
import { formatIndianNumber } from '@/lib/financial-utils';

const DatePickerInput = forwardRef(({ value, onClick, ...props }, ref) => (
  <input
    onClick={onClick}
    ref={ref}
    value={value ?? ''}
    {...props}
  />
));
DatePickerInput.displayName = 'DatePickerInput';

export default function AddNewStudent() {
  const MAX_ROLL = 10;
  const MAX_MOBILE_LEN = 10;
  const _MAX_ANNUAL_INCOME = 99999999; // adjust to DB limit if known

  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'', email:'' });
  const [mobileError, setMobileError] = useState('');
  const [incomeError, setIncomeError] = useState('');
  const [_annualIncomeDisplay, setAnnualIncomeDisplay] = useState('');
  const [personal, setPersonal] = useState({ 
    father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', 
    mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', 
    curr_house_no: '', curr_street: '', curr_apartment: '', curr_city: '', curr_state: '', curr_pincode: '', curr_country: 'India',
    perm_house_no: '', perm_street: '', perm_apartment: '', perm_city: '', perm_state: '', perm_pincode: '', perm_country: 'India',
    is_current_same_as_permanent: false,
    seat_allotted_category:'', identification_marks:'', blood_group: '', guardian_mobile: '' 
  });
  const [academic, setAcademic] = useState({ qualifying_exam:'TG EAPCET', previous_college_details:'', medium_of_instruction:'English', ranks:'', ssc_marks:'', inter_marks:'' });

  const handleCheckboxChange = (checked) => {
    setPersonal(prev => {
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
    setPersonal(prev => {
      const updated = { ...prev, [field]: value };
      if (prev.is_current_same_as_permanent && field.startsWith('curr_')) {
        const permField = field.replace('curr_', 'perm_');
        updated[permField] = value;
      }
      return updated;
    });
  };
  const [files, setFiles] = useState({ pfp: null, signature: null });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [rollNoError, setRollNoError] = useState('');
  const [_isTotalMarksAutofilled, setIsTotalMarksAutofilled] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (basic.roll_no) {
        // Enforce roll length client-side
        const trimmed = String(basic.roll_no || '').toUpperCase().slice(0, MAX_ROLL);
        if (trimmed !== basic.roll_no) setBasic(prev => ({ ...prev, roll_no: trimmed }));
        const { isValid } = validateRollNo(basic.roll_no);
        if (basic.roll_no.length === MAX_ROLL && isValid) {
          setRollNoError('');
        } else if (basic.roll_no.length === MAX_ROLL && !isValid) {
          setRollNoError('Invalid Roll Number format.');
        } else {
          setRollNoError(`Roll Number must be exactly ${MAX_ROLL} characters long`);
        }
        const entranceExam = getEntranceExamQualified(basic.roll_no);
        const newQualifyingExam = entranceExam || 'TG EAPCET';

        setAcademic(prev => ({ ...prev, qualifying_exam: newQualifyingExam, ranks: '' })); // Initialize ranks to empty
        setIsTotalMarksAutofilled(false); // Ranks is not autofilled based on exam
      } else {
        setRollNoError('');
        setAcademic(prev => ({ ...prev, qualifying_exam: 'TG EAPCET', ranks: '' })); // Reset to default if rollNo is empty
        setIsTotalMarksAutofilled(false);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [basic.roll_no]);

  const addRequiredFilled = () => {
    return basic.admission_no.trim() && basic.roll_no.trim() && !rollNoError && basic.name.trim() && basic.date_of_birth && basic.gender && (basic.mobile || '').length === MAX_MOBILE_LEN && basic.email.trim();
  };

  const formatAadhaar = (val) => {
    if (val == null) return '';
    const digits = String(val).replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    let processedFile = file;
    try {
      const { compressImage } = await import('@/lib/image-compressor');
      processedFile = await compressImage(file, 1200, 1200, 0.6);
    } catch (err) {
      console.error('Image compression failed:', err);
    }

    // 1MB limit
    if (processedFile.size > 1 * 1024 * 1024) {
      toast.error(`${type === 'pfp' ? 'Photo' : 'Signature'} file is too large. Max limit is 1MB.`);
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFiles(prev => ({ ...prev, [type]: reader.result }));
    };
    reader.readAsDataURL(processedFile);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!addRequiredFilled()) return;
    setAddLoading(true);
    const toastId = toast.loading('Saving new student...');
    try{
      const payload = {
        admission_no: basic.admission_no || null,
        roll_no: basic.roll_no || null,
        name: basic.name || null,
        fee_reimbursement: basic.fee_reimbursement ? String(basic.fee_reimbursement).trim().toUpperCase() : null,
        father_name: personal.father_name || null,
        mother_name: personal.mother_name || null,
        date_of_birth: basic.date_of_birth || null,
        place_of_birth: personal.place_of_birth || null,
        gender: basic.gender || null,
        nationality: personal.nationality || null,
        religion: personal.religion || null,
        sub_caste: personal.sub_caste || null,
        category: personal.category || null,
        curr_house_no: personal.curr_house_no || null,
        curr_street: personal.curr_street || null,
        curr_apartment: personal.curr_apartment || null,
        curr_city: personal.curr_city || null,
        curr_state: personal.curr_state || null,
        curr_pincode: personal.curr_pincode || null,
        curr_country: personal.curr_country || 'India',
        perm_house_no: personal.perm_house_no || null,
        perm_street: personal.perm_street || null,
        perm_apartment: personal.perm_apartment || null,
        perm_city: personal.perm_city || null,
        perm_state: personal.perm_state || null,
        perm_pincode: personal.perm_pincode || null,
        perm_country: personal.perm_country || 'India',
        is_current_same_as_permanent: !!personal.is_current_same_as_permanent,
        mobile: basic.mobile || null,
        email: basic.email || null,
        qualifying_exam: academic.qualifying_exam || null,
        mother_tongue: personal.mother_tongue || null,
        father_occupation: personal.father_occupation || null,
        annual_income: personal.annual_income ? personal.annual_income.toString().replace(/,/g, '') : null,
        guardian_mobile: personal.guardian_mobile || null,
        aadhaar_no: personal.aadhaar_no || null,
        ranks: academic.ranks ? Number(academic.ranks) : null,
        ssc_marks: academic.ssc_marks || null,
        inter_marks: academic.inter_marks || null,
        previous_college_details: academic.previous_college_details || null,
        medium_of_instruction: academic.medium_of_instruction || null,
        area_status: personal.area_status || null,
        seat_allotted_category: personal.seat_allotted_category || null,
        identification_marks: personal.identification_marks || null,
        blood_group: personal.blood_group || null,
        pfp: files.pfp,
        signature: files.signature,
      };

      const res = await fetch('/api/staff/admission/students', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast.success('Student added successfully', { id: toastId });
      setSavedRollLocked(true);
      setShowAddForm(false);
      smoothScrollToTop({ behavior: 'smooth' });
      setBasic({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', email:''});
      setPersonal({ 
        father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', 
        mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', 
        curr_house_no: '', curr_street: '', curr_apartment: '', curr_city: '', curr_state: '', curr_pincode: '', curr_country: 'India',
        perm_house_no: '', perm_street: '', perm_apartment: '', perm_city: '', perm_state: '', perm_pincode: '', perm_country: 'India',
        is_current_same_as_permanent: false,
        seat_allotted_category:'', identification_marks:'', blood_group: '', guardian_mobile: '' 
      });
      // reset fee_reimbursement
      setBasic(prev => ({ ...prev, fee_reimbursement: undefined }));
      setAnnualIncomeDisplay('');
      setIncomeError('');
      setAcademic({ qualifying_exam:'TG EAPCET', previous_college_details:'', medium_of_instruction:'English', ranks:'', ssc_marks:'', inter_marks:'' });
      setFiles({ pfp: null, signature: null });
      setSavedRollLocked(false);
      setTimeout(()=>{ setShowAddForm(true); }, 1500);
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setAddLoading(false); }
  };
  
  const genders = COLLEGE_CONFIG.genders;
  const categories = COLLEGE_CONFIG.categories;

  const feeReimbursementOptions = ['NO', 'YES', 'GOV'];

  return (
    showAddForm ? (
      <form onSubmit={handleAddStudent} className="space-y-6 animate-fadeIn">
        {/* Section 1: Admission Details */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded-md border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <svg className="w-4 h-4 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <h3 className="text-sm font-semibold text-gray-800">Admission Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Admission No*</label>
              <input value={basic.admission_no} onChange={e=>setBasic({...basic, admission_no:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578] " />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Roll Number*</label>
              <div className="relative">
                <input value={basic.roll_no} onChange={(e)=>{
                  const v = String(e.target.value || '').toUpperCase().slice(0, 10);
                  setBasic({...basic, roll_no: v});
                }} disabled={savedRollLocked} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578] " maxLength={MAX_ROLL} />
                {savedRollLocked && (<span className="absolute right-2 top-2 text-xs">🔒</span>)}
              </div>
              {rollNoError && basic.roll_no.length !== 0 && <div className="text-[10px] text-red-500 mt-0.5">{rollNoError}</div>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Course</label>
              <input value={getBranchFromRoll(basic.roll_no) || ''} disabled className="w-full p-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Admission Type</label>
              <input value={getAdmissionTypeFromRoll(basic.roll_no) || ''} disabled className="w-full p-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fee Reimbursement</label>
              <select value={basic.fee_reimbursement || 'NO'} onChange={e=>setBasic({...basic, fee_reimbursement: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                {feeReimbursementOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
              <select value={personal.category} onChange={e=>setPersonal({...personal, category:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Seat Allotted Category</label>
              <input value={personal.seat_allotted_category || ''} onChange={e=>setPersonal({...personal, seat_allotted_category:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578] " />
            </div>
          </div>
        </div>

        {/* Section 2: Personal Information */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded-md border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <svg className="w-4 h-4 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <h3 className="text-sm font-semibold text-gray-800">Personal Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Student Name*</label>
              <input value={basic.name} onChange={e=>setBasic({...basic, name:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Date of Birth*</label>
              <DatePicker
                selected={parseDate(basic.date_of_birth)}
                onChange={(date) => setBasic({ ...basic, date_of_birth: formatDate(date) })}
                dateFormat="dd-MM-yyyy"
                placeholderText="DD-MM-YYYY"
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]"
                showYearDropdown
                dropdownMode="select"
                customInput={<DatePickerInput className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Gender*</label>
              <select value={basic.gender} onChange={e=>setBasic({...basic, gender:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                {genders.map(g=> <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Email Address*</label>
              <input type="email" value={basic.email} onChange={e=>setBasic({...basic, email:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Mobile Number*</label>
              <div className="flex items-center">
                <span className="px-2 py-2 border border-gray-300 border-r-0 bg-gray-100 text-xs text-gray-500 rounded-l-md">+91</span>
                <input
                  value={basic.mobile}
                  onChange={(e) => {
                    const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, MAX_MOBILE_LEN);
                    setBasic({...basic, mobile: digits});
                    if (digits.length !== MAX_MOBILE_LEN) setMobileError('Must be 10 digits'); else setMobileError('');
                  }}
                  onPaste={(e) => { const pasted = (e.clipboardData || window.clipboardData).getData('text'); const digits = pasted.replace(/\D/g,'').slice(0, MAX_MOBILE_LEN); setBasic(prev=>({...prev, mobile: digits})); e.preventDefault(); }}
                  className="w-full p-2 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:border-[#0b3578]"
                  inputMode="numeric"
                  maxLength={MAX_MOBILE_LEN}
                />
              </div>
              {mobileError && <div className="text-[10px] text-red-500 mt-0.5">{mobileError}</div>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Aadhaar Number</label>
              <input value={personal.aadhaar_no} onChange={e=>setPersonal({...personal, aadhaar_no: formatAadhaar(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" maxLength={14} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nationality</label>
              <input value={personal.nationality} onChange={e=>setPersonal({...personal, nationality:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Religion</label>
              <select value={personal.religion || ''} onChange={e=>setPersonal({...personal, religion:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                  <option value="">Select</option>
                  {COLLEGE_CONFIG.religions.map(r => <option key={r} value={r.toUpperCase()}>{r.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Blood Group</label>
              <select value={personal.blood_group || ''} onChange={e=>setPersonal({...personal, blood_group: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                <option value="">Select</option>
                {COLLEGE_CONFIG.bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Mother Tongue</label>
              <input value={personal.mother_tongue} onChange={e=>setPersonal({...personal, mother_tongue:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Area Status</label>
              <select value={personal.area_status} onChange={e=>setPersonal({...personal, area_status:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                <option>Local</option>
                <option>Non-Local</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Place of Birth</label>
              <input value={personal.place_of_birth} onChange={e=>setPersonal({...personal, place_of_birth:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Sub Caste</label>
              <input value={personal.sub_caste} onChange={e=>setPersonal({...personal, sub_caste:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            
            {/* Addresses Nested */}
            <div className="md:col-span-4 border-t border-slate-100 pt-3 mt-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Address */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-500 mb-2 ">Current Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input placeholder="House No*" value={personal.curr_house_no} onChange={e => handleAddressChange('curr_house_no', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  <input placeholder="Apartment / Landmark" value={personal.curr_apartment} onChange={e => handleAddressChange('curr_apartment', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  <input placeholder="Street*" value={personal.curr_street} onChange={e => handleAddressChange('curr_street', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-2" />
                  <input placeholder="City*" value={personal.curr_city} onChange={e => handleAddressChange('curr_city', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  <input placeholder="State*" value={personal.curr_state} onChange={e => handleAddressChange('curr_state', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  <input placeholder="PIN Code*" value={personal.curr_pincode} onChange={e => handleAddressChange('curr_pincode', e.target.value.replace(/\D/g, ''))} maxLength={6} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  <input placeholder="Country*" value={personal.curr_country} onChange={e => handleAddressChange('curr_country', e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input 
                    type="checkbox" 
                    id="add_is_current_same_as_permanent" 
                    checked={personal.is_current_same_as_permanent} 
                    onChange={e => handleCheckboxChange(e.target.checked)} 
                    className="h-3.5 w-3.5 text-[#0b3578] border-slate-300 rounded cursor-pointer" 
                  />
                  <label htmlFor="add_is_current_same_as_permanent" className="text-xs font-semibold text-gray-600 cursor-pointer">
                    Same as permanent address
                  </label>
                </div>
              </div>

              {/* Permanent Address */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-500 mb-2 ">Permanent Address</h4>
                {!personal.is_current_same_as_permanent ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input placeholder="House No*" value={personal.perm_house_no} onChange={e => setPersonal({...personal, perm_house_no: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                    <input placeholder="Apartment / Landmark" value={personal.perm_apartment} onChange={e => setPersonal({...personal, perm_apartment: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                    <input placeholder="Street*" value={personal.perm_street} onChange={e => setPersonal({...personal, perm_street: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-2" />
                    <input placeholder="City*" value={personal.perm_city} onChange={e => setPersonal({...personal, perm_city: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                    <input placeholder="State*" value={personal.perm_state} onChange={e => setPersonal({...personal, perm_state: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                    <input placeholder="PIN Code*" value={personal.perm_pincode} onChange={e => setPersonal({...personal, perm_pincode: e.target.value.replace(/\D/g, '')})} maxLength={6} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                    <input placeholder="Country*" value={personal.perm_country} onChange={e => setPersonal({...personal, perm_country: e.target.value})} className="p-2 text-sm border border-gray-300 rounded-md sm:col-span-1" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 bg-gray-100/50 border border-gray-300 border-dashed rounded-md">
                    <span className="text-sm font-medium text-gray-400">Synced with current address</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Guardian Information */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded-md border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <svg className="w-4 h-4 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <h3 className="text-sm font-semibold text-gray-800">Guardian Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Father Name</label>
              <input value={personal.father_name} onChange={e=>setPersonal({...personal, father_name:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Mother Name</label>
              <input value={personal.mother_name} onChange={e=>setPersonal({...personal, mother_name:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Father Occupation</label>
              <input value={personal.father_occupation} onChange={e=>setPersonal({...personal, father_occupation:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Annual Income</label>
              <input 
                value={personal.annual_income} 
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (raw && parseInt(raw) > 2000000) {
                    setIncomeError('Annual income exceeds max limit of 2,000,000');
                  } else {
                    setIncomeError('');
                  }
                  setPersonal({...personal, annual_income: formatIndianNumber(raw)});
                }} 
                className={`w-full p-2 text-sm border ${incomeError ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:border-[#0b3578]`}
              />
              {incomeError && <div className="text-[10px] text-red-500 mt-0.5">{incomeError}</div>}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Guardian Mobile</label>
              <div className="flex items-center">
                <span className="px-2 py-2 border border-gray-300 border-r-0 bg-gray-100 text-xs text-gray-500 rounded-l-md">+91</span>
                <input
                  value={personal.guardian_mobile}
                  onChange={(e) => {
                    const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, 10);
                    setPersonal({...personal, guardian_mobile: digits});
                  }}
                  className="w-full p-2 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:border-[#0b3578]"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Academic Details */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded-md border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <svg className="w-4 h-4 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
            <h3 className="text-sm font-semibold text-gray-800">Academic Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Qualifying Exam</label>
              <select value={academic.qualifying_exam} onChange={e => setAcademic({...academic, qualifying_exam:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                <option>TG EAPCET</option><option>TG ECET</option><option>PGECET</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Entrance Rank</label>
              <input type="number" value={academic.ranks} onChange={e => setAcademic({...academic, ranks:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">SSC (10th) Marks</label>
              <input value={academic.ssc_marks} onChange={e => setAcademic({...academic, ssc_marks:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Inter / Diploma Marks</label>
              <input value={academic.inter_marks} onChange={e => setAcademic({...academic, inter_marks:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Medium of Instruction</label>
              <select value={academic.medium_of_instruction} onChange={e=>setAcademic({...academic, medium_of_instruction:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]">
                <option>English</option><option>Telugu</option><option>Other</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-gray-700 block mb-1">Previous College Details</label>
              <input value={academic.previous_college_details} onChange={e=>setAcademic({...academic, previous_college_details:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578]" />
            </div>
            <div className="md:col-span-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Identification Marks</label>
              <textarea value={personal.identification_marks} onChange={e=>setPersonal({...personal, identification_marks:e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0b3578] h-12 resize-none" />
            </div>
          </div>
        </div>

        {/* Section 5: Documents */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-4 rounded-md border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <svg className="w-4 h-4 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            <h3 className="text-sm font-semibold text-gray-800">Documents Upload</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Student Photo (Max 1MB)</label>
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'pfp')} className="p-1.5 text-xs border border-gray-300 rounded-md w-full bg-white" />
                {files.pfp && <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={files.pfp} alt="Preview" className="h-10 w-10 object-cover border border-gray-300 rounded-full" width={40} height={40} unoptimized />}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Signature (Max 1MB)</label>
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} className="p-1.5 text-xs border border-gray-300 rounded-md w-full bg-white" />
                {files.signature && <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={files.signature} alt="Preview" className="h-10 w-24 object-contain border border-gray-300 rounded-md bg-white p-1" width={96} height={40} unoptimized />}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={!addRequiredFilled() || addLoading} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${(!addRequiredFilled() || addLoading) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#0b3578] text-white hover:bg-[#082654] shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'}`}>
            {addLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                <span>Save Student</span>
              </>
            )}
          </button>
        </div>
      </form>
    ) : (
      <div className="p-6 bg-[#0b3578]/5 border border-[#0b3578]/10 rounded-md flex items-center gap-4">
        <div className="w-10 h-10 bg-[#0b3578] text-white rounded-full flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <div>
          <h4 className="font-bold text-[#0b3578]">Student Registered Successfully</h4>
          <p className="text-sm text-gray-600 mt-1">The system is resetting the form for the next entry...</p>
        </div>
      </div>
    )
  );
}
