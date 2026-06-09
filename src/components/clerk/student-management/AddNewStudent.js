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
  const MAX_ANNUAL_INCOME = 99999999; // adjust to DB limit if known

  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'', email:'' });
  const [mobileError, setMobileError] = useState('');
  const [incomeError, setIncomeError] = useState('');
  const [annualIncomeDisplay, setAnnualIncomeDisplay] = useState('');
  const [personal, setPersonal] = useState({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', address:'', seat_allotted_category:'', identification_marks:'', blood_group: '', guardian_mobile: '' });
  const [academic, setAcademic] = useState({ qualifying_exam:'TG EAPCET', previous_college_details:'', medium_of_instruction:'English', ranks:'', ssc_marks:'', inter_marks:'' });
  const [files, setFiles] = useState({ pfp: null, signature: null });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [rollNoError, setRollNoError] = useState('');
  const [isTotalMarksAutofilled, setIsTotalMarksAutofilled] = useState(false);

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

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1MB limit
    if (file.size > 1 * 1024 * 1024) {
      toast.error(`${type === 'pfp' ? 'Photo' : 'Signature'} file is too large. Max limit is 1MB.`);
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFiles(prev => ({ ...prev, [type]: reader.result }));
    };
    reader.readAsDataURL(file);
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
        address: personal.address || null,
        mobile: basic.mobile || null,
        email: basic.email || null,
        qualifying_exam: academic.qualifying_exam || null,
        mother_tongue: personal.mother_tongue || null,
        father_occupation: personal.father_occupation || null,
        annual_income: personal.annual_income ? personal.annual_income.toString().replace(/,/g, '') : null,
        guardian_mobile: personal.guardian_mobile || null,
        student_aadhar_no: personal.aadhaar_no || null,
        ranks: academic.ranks ? Number(academic.ranks) : null,
        ssc_marks: academic.ssc_marks || null,
        inter_marks: academic.inter_marks || null,
        blood_group: personal.blood_group || null,
        pfp: files.pfp,
        signature: files.signature,
      };

      const res = await fetch('/api/clerk/admission/students', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast.success('Student added successfully', { id: toastId });
      setSavedRollLocked(true);
      setShowAddForm(false);
      smoothScrollToTop({ behavior: 'smooth' });
      setBasic({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', email:''});
      setPersonal({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', address:'', seat_allotted_category:'', identification_marks:'', blood_group: '', guardian_mobile: '' });
      // reset fee_reimbursement
      setBasic(prev => ({ ...prev, fee_reimbursement: undefined }));
      setAnnualIncomeDisplay('');
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
      <form onSubmit={handleAddStudent} className="space-y-6">
        <div>
          <h3 className="font-bold">Section A: Basic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <input placeholder="Admission Number*" value={basic.admission_no} onChange={e=>setBasic({...basic, admission_no:e.target.value})} className="p-2 border rounded" />
            <div className="relative">
              <input placeholder="Roll Number*" value={basic.roll_no} onChange={(e)=>{
                const v = String(e.target.value || '').toUpperCase().slice(0, 10);
                setBasic({...basic, roll_no: v});
              }} disabled={savedRollLocked} className="p-2 border rounded w-full" maxLength={MAX_ROLL} />
              {rollNoError && basic.roll_no.length !== 0 && <div className="text-xs text-red-600 mt-1">{rollNoError}</div>}
              {savedRollLocked && (<span className="absolute right-2 top-2 text-sm">🔒</span>)}
            </div>
            <input placeholder="Student Name*" value={basic.name} onChange={e=>setBasic({...basic, name:e.target.value})} className="p-2 border rounded" />
            <DatePicker
              selected={parseDate(basic.date_of_birth)}
              onChange={(date) => setBasic({ ...basic, date_of_birth: formatDate(date) })}
              dateFormat="dd-MM-yyyy"
              placeholderText="DD-MM-YYYY"
              className="p-2 border rounded w-full"
              showYearDropdown
              dropdownMode="select"
              customInput={<DatePickerInput className="p-2 border rounded w-full" />}
            />
            <select value={basic.gender} onChange={e=>setBasic({...basic, gender:e.target.value})} className="p-2 border rounded">
              {genders.map(g=> <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={basic.fee_reimbursement || 'NO'} onChange={e=>setBasic({...basic, fee_reimbursement: e.target.value})} className="p-2 border rounded">
              {feeReimbursementOptions.map(o => (
                <option key={o} value={o}>
                  {o === 'YES'
                    ? 'Fee Reimbursement: YES'
                    : o === 'NO'
                      ? 'Fee Reimbursement: NO'
                      : 'Fee Reimbursement: GOV'}
                </option>
              ))}
            </select>
            <input placeholder="Course" value={getBranchFromRoll(basic.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100" />
            <input placeholder="Admission Type" value={getAdmissionTypeFromRoll(basic.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100" />
            <div className="flex items-center">
              <span className="px-3 py-2 border border-r-0 bg-gray-100">+91</span>
              <input
                placeholder="Mobile*"
                value={basic.mobile}
                onChange={(e) => {
                  const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, MAX_MOBILE_LEN);
                  setBasic({...basic, mobile: digits});
                  if (digits.length !== MAX_MOBILE_LEN) setMobileError('Mobile must be 10 digits'); else setMobileError('');
                }}
                onPaste={(e) => { const pasted = (e.clipboardData || window.clipboardData).getData('text'); const digits = pasted.replace(/\D/g,'').slice(0, MAX_MOBILE_LEN); setBasic(prev=>({...prev, mobile: digits})); e.preventDefault(); }}
                className="p-2 border rounded w-full"
                inputMode="numeric"
                maxLength={MAX_MOBILE_LEN}
              />
            </div>
            {mobileError && <div className="text-xs text-red-600 mt-1">{mobileError}</div>}
            <input type="email" placeholder="Email*" value={basic.email} onChange={e=>setBasic({...basic, email:e.target.value})} className="p-2 border rounded" />
          </div>
        </div>

        <div>
          <h3 className="font-bold">Section B: Personal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <input placeholder="Father Name" value={personal.father_name} onChange={e=>setPersonal({...personal, father_name:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Mother Name" value={personal.mother_name} onChange={e=>setPersonal({...personal, mother_name:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Nationality" value={personal.nationality} onChange={e=>setPersonal({...personal, nationality:e.target.value})} className="p-2 border rounded" />
            <select value={personal.religion || ''} onChange={e=>setPersonal({...personal, religion:e.target.value})} className="p-2 border rounded">
                <option value="">Select Religion</option>
                {COLLEGE_CONFIG.religions.map(r => (
                    <option key={r} value={r.toUpperCase()}>{r.toUpperCase()}</option>
                ))}
            </select>
            <select value={personal.category} onChange={e=>setPersonal({...personal, category:e.target.value})} className="p-2 border rounded">{categories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
            <input placeholder="Sub Caste" value={personal.sub_caste} onChange={e=>setPersonal({...personal, sub_caste:e.target.value})} className="p-2 border rounded" />
            <select value={personal.area_status} onChange={e=>setPersonal({...personal, area_status:e.target.value})} className="p-2 border rounded"><option>Local</option><option>Non-Local</option></select>
            <input placeholder="Mother Tongue" value={personal.mother_tongue} onChange={e=>setPersonal({...personal, mother_tongue:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Place of Birth" value={personal.place_of_birth} onChange={e=>setPersonal({...personal, place_of_birth:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Father Occupation" value={personal.father_occupation} onChange={e=>setPersonal({...personal, father_occupation:e.target.value})} className="p-2 border rounded" />
            <input 
              placeholder="Annual Income"
              value={personal.annual_income} 
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                if (raw && parseInt(raw) > 2000000) return;
                setPersonal({...personal, annual_income: formatIndianNumber(raw)});
              }} 
              className="p-2 border rounded"
            />
            <div className="flex items-center">
              <span className="px-3 py-2 border border-r-0 bg-gray-100 text-sm text-gray-500 font-medium">+91</span>
              <input
                placeholder="Guardian Mobile"
                value={personal.guardian_mobile}
                onChange={(e) => {
                  const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, 10);
                  setPersonal({...personal, guardian_mobile: digits});
                }}
                className="p-2 border rounded rounded-l-none w-full"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            {incomeError && <div className="text-xs text-red-600 mt-1">{incomeError}</div>}
            <input placeholder="Aadhaar Number" value={personal.aadhaar_no} onChange={e=>setPersonal({...personal, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" maxLength={14} />
            <select value={personal.blood_group || ''} onChange={e=>setPersonal({...personal, blood_group: e.target.value})} className="p-2 border rounded">
              <option value="">Blood Group (optional)</option>
              {COLLEGE_CONFIG.bloodGroups.map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
        </div>
        </div>
              <textarea placeholder="Address" value={personal.address} onChange={e=>setPersonal({...personal, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
              <textarea placeholder="Identification Marks (optional)" value={personal.identification_marks} onChange={e=>setPersonal({...personal, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
        <div>
          <h3 className="font-bold">Section C: Academic & Identification</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <select
              value={academic.qualifying_exam}
              onChange={e => setAcademic({...academic, qualifying_exam:e.target.value})}
              className="p-2 border rounded"
            >
              <option>TG EAPCET</option>
              <option>TG ECET</option>
              <option>PGECET</option>
            </select>
            <input
              placeholder="SSC (10th) Marks"
              value={academic.ssc_marks}
              onChange={e => setAcademic({...academic, ssc_marks:e.target.value})}
              className="p-2 border rounded"
            />
            <input
              placeholder="Inter / Diploma Marks"
              value={academic.inter_marks}
              onChange={e => setAcademic({...academic, inter_marks:e.target.value})}
              className="p-2 border rounded"
            />
            <textarea placeholder="Previous College Details" value={academic.previous_college_details} onChange={e=>setAcademic({...academic, previous_college_details:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" rows={3} style={{overflow:'hidden'}} />
            <select value={academic.medium_of_instruction} onChange={e=>setAcademic({...academic, medium_of_instruction:e.target.value})} className="p-2 border rounded"><option>Telugu</option><option>English</option><option>Other</option></select>
            
            <input
              placeholder="Entrance Rank"
              type="number"
              value={academic.ranks}
              onChange={e => setAcademic({...academic, ranks:e.target.value})}
              className="p-2 border rounded"
            />
          </div>
        </div>

        <div>
          <h3 className="font-bold">Section D: Documents Upload (Max 1MB)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Student Photo (PFP)</label>
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'pfp')} className="p-2 border rounded w-full" />
              {files.pfp && <Image src={files.pfp} alt="Preview" className="h-20 w-20 object-cover border rounded mt-1" width={80} height={80} unoptimized />}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Student Signature</label>
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} className="p-2 border rounded w-full" />
              {files.signature && <Image src={files.signature} alt="Preview" className="h-12 w-32 object-contain border rounded mt-1" width={128} height={48} unoptimized />}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={!addRequiredFilled() || addLoading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">{addLoading? 'Saving...':'Save'}</button>
        </div>
      </form>
      ) : (
        <div className="p-4 bg-green-50 text-green-800 rounded">Data added to Database</div>
      )
  );
}
