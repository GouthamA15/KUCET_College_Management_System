"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { validateRollNo, getBranchFromRoll, getAdmissionTypeFromRoll, getEntranceExamQualified } from '@/lib/rollNumber';

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
  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'+91', email:'' });
  const [personal, setPersonal] = useState({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', address:'', seat_allotted_category:'', identification_marks:'' });
  const [academic, setAcademic] = useState({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', ranks:'' });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [rollNoError, setRollNoError] = useState('');
  const [isQualifyingExamAutofilled, setIsQualifyingExamAutofilled] = useState(false);
  const [isTotalMarksAutofilled, setIsTotalMarksAutofilled] = useState(false);

  useEffect(() => {
    if (basic.roll_no) {
      const { isValid } = validateRollNo(basic.roll_no);
      if (isValid) {
        setRollNoError('');
      } else {
        setRollNoError('Invalid Roll Number format');
      }
      const entranceExam = getEntranceExamQualified(basic.roll_no);
      let newQualifyingExam = 'EAMCET'; // Default

      if (entranceExam) {
        newQualifyingExam = entranceExam;
      }
      setAcademic(prev => ({ ...prev, qualifying_exam: newQualifyingExam, ranks: '' })); // Initialize ranks to empty
      setIsQualifyingExamAutofilled(!!entranceExam);
      setIsTotalMarksAutofilled(false); // Ranks is not autofilled based on exam
    } else {
      setRollNoError('');
      setAcademic(prev => ({ ...prev, qualifying_exam: 'EAMCET', ranks: '' })); // Reset to default if rollNo is empty
      setIsQualifyingExamAutofilled(false);
      setIsTotalMarksAutofilled(false);
    }
  }, [basic.roll_no]);

  const addRequiredFilled = () => {
    return basic.admission_no.trim() && basic.roll_no.trim() && !rollNoError && basic.name.trim() && basic.date_of_birth && basic.gender && basic.mobile.trim() && basic.email.trim();
  };

  const formatAadhaar = (val) => {
    if (val == null) return '';
    const digits = String(val).replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
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
        annual_income: personal.annual_income || null,
        student_aadhar_no: personal.aadhaar_no || null,
        ranks: academic.ranks ? Number(academic.ranks) : null,
      };

      const res = await fetch('/api/clerk/admission/students', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast.success('Student added successfully', { id: toastId });
      setSavedRollLocked(true);
      setShowAddForm(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      setBasic({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'+91', email:''});
      setPersonal({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', address:'', seat_allotted_category:'', identification_marks:'' });
      setAcademic({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', ranks:'' });
      setSavedRollLocked(false);
      setTimeout(()=>{ setShowAddForm(true); }, 1500);
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setAddLoading(false); }
  };
  
  const genders = ['Male', 'Female'];
  const categories = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'];

  return (
    showAddForm ? (
      <form onSubmit={handleAddStudent} className="space-y-6">
        <div>
          <h3 className="font-bold">Section A: Basic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <input placeholder="Admission Number*" value={basic.admission_no} onChange={e=>setBasic({...basic, admission_no:e.target.value})} className="p-2 border rounded" />
            <div className="relative">
              <input placeholder="Roll Number*" value={basic.roll_no} onChange={e=>setBasic({...basic, roll_no:e.target.value})} disabled={savedRollLocked} className="p-2 border rounded w-full" />
              {rollNoError && <div className="text-xs text-red-600 mt-1">{rollNoError}</div>}
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
            <input placeholder="Course" value={getBranchFromRoll(basic.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100" />
            <input placeholder="Admission Type" value={getAdmissionTypeFromRoll(basic.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100" />
            <input placeholder="Mobile*" value={basic.mobile} onChange={e=>setBasic({...basic, mobile:e.target.value})} className="p-2 border rounded" />
            <input type="email" placeholder="Email*" value={basic.email} onChange={e=>setBasic({...basic, email:e.target.value})} className="p-2 border rounded" />
          </div>
        </div>

        <div>
          <h3 className="font-bold">Section B: Personal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <input placeholder="Father Name" value={personal.father_name} onChange={e=>setPersonal({...personal, father_name:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Mother Name" value={personal.mother_name} onChange={e=>setPersonal({...personal, mother_name:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Nationality" value={personal.nationality} onChange={e=>setPersonal({...personal, nationality:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Religion" value={personal.religion} onChange={e=>setPersonal({...personal, religion:e.target.value})} className="p-2 border rounded" />
            <select value={personal.category} onChange={e=>setPersonal({...personal, category:e.target.value})} className="p-2 border rounded">{categories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
            <input placeholder="Sub Caste" value={personal.sub_caste} onChange={e=>setPersonal({...personal, sub_caste:e.target.value})} className="p-2 border rounded" />
            <select value={personal.area_status} onChange={e=>setPersonal({...personal, area_status:e.target.value})} className="p-2 border rounded"><option>Local</option><option>Non-Local</option></select>
            <input placeholder="Mother Tongue" value={personal.mother_tongue} onChange={e=>setPersonal({...personal, mother_tongue:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Place of Birth" value={personal.place_of_birth} onChange={e=>setPersonal({...personal, place_of_birth:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Father Occupation" value={personal.father_occupation} onChange={e=>setPersonal({...personal, father_occupation:e.target.value})} className="p-2 border rounded" />
            <input placeholder="Annual Income" value={personal.annual_income || ''} onChange={e=>setPersonal({...personal, annual_income:e.target.value})} type="number" className="p-2 border rounded" />
            <input placeholder="Aadhaar Number" value={personal.aadhaar_no} onChange={e=>setPersonal({...personal, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" maxLength={14} />
        </div>
        </div>
              <textarea placeholder="Address" value={personal.address} onChange={e=>setPersonal({...personal, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
        <div>
              <textarea placeholder="Identification Marks (optional)" value={personal.identification_marks} onChange={e=>setPersonal({...personal, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <select
              value={academic.qualifying_exam}
              onChange={e => setAcademic({...academic, qualifying_exam:e.target.value})}
              disabled={isQualifyingExamAutofilled}
              className={`p-2 border rounded ${isQualifyingExamAutofilled ? 'bg-gray-100' : ''}`}
            >
              <option>EAMCET</option>
              <option>ECET</option>
              <option>PGECET</option>
            </select>
            <textarea placeholder="Previous College Details" value={academic.previous_college_details} onChange={e=>setAcademic({...academic, previous_college_details:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" rows={3} style={{overflow:'hidden'}} />
            <select value={academic.medium_of_instruction} onChange={e=>setAcademic({...academic, medium_of_instruction:e.target.value})} className="p-2 border rounded"><option>Telugu</option><option>English</option><option>Other</option></select>
            
            <input
              placeholder="Ranks"
              type="number"
              value={academic.ranks}
              onChange={e => setAcademic({...academic, ranks:e.target.value})}
              className="p-2 border rounded"
            />
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
