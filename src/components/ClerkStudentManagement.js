"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import Image from 'next/image';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { validateRollNo, getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';

const DatePickerInput = forwardRef(({ value, onClick, ...props }, ref) => (
  <input
    onClick={onClick}
    ref={ref}
    value={value}
    {...props}
  />
));
DatePickerInput.displayName = 'DatePickerInput';

export default function ClerkStudentManagement() {
  const [section, setSection] = useState('home'); // 'add','fetch','view'

  // Add New Student form state
  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'+91', email:'' });
  const [personal, setPersonal] = useState({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', guardian_mobile:'+91', address:'', seat_allotted_category:'', identification_marks:'', ncc_nss_details:'' });
  const [academic, setAcademic] = useState({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', total_marks:'', marks_secured:'' });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [rollNoError, setRollNoError] = useState('');

  // Fetch state
  const [fetchRoll, setFetchRoll] = useState('');
  const [fetchAdmission, setFetchAdmission] = useState('');
  const [fetchName, setFetchName] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchedStudent, setFetchedStudent] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [fetchedList, setFetchedList] = useState([]);

  // View/Edit state
  const [editValues, setEditValues] = useState({ address:'', mobile:'', email:'', guardian_mobile:'', father_occupation:'', annual_income:'' });
  const [personalFull, setPersonalFull] = useState({});
  const [academicsList, setAcademicsList] = useState([]);
  const [feesList, setFeesList] = useState([]);
  const [feeDetails, setFeeDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [originalEditValues, setOriginalEditValues] = useState(null);
  const [originalPersonalFull, setOriginalPersonalFull] = useState(null);
  const [originalAcademicsList, setOriginalAcademicsList] = useState(null);

  useEffect(() => {
    if (basic.roll_no) {
      const { isValid } = validateRollNo(basic.roll_no);
      if (isValid) {
        setRollNoError('');
      } else {
        setRollNoError('Invalid Roll Number format');
      }
    } else {
      setRollNoError('');
    }
  }, [basic.roll_no]);

  // Scroll to top whenever user switches sections (Add / Fetch / View)
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }, [section]);

  const addRequiredFilled = () => {
    return basic.admission_no.trim() && basic.roll_no.trim() && !rollNoError && basic.name.trim() && basic.date_of_birth && basic.gender && basic.mobile.trim() && basic.email.trim();
  };

  const canFetch = () => {
    return fetchRoll.trim() || fetchAdmission.trim() || fetchName.trim();
  };

  const sanitizeDigits = (input, maxLen = 10) => {
    if (input == null) return '';
    const s = String(input).replace(/\D/g, '');
    return s.slice(0, maxLen);
  };

  // Format Aadhaar as 4-4-4 groups with spaces
  const formatAadhaar = (val) => {
    if (val == null) return '';
    const digits = String(val).replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  // Add Student
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
        father_guardian_mobile_no: personal.guardian_mobile || null,
        identification_marks: personal.identification_marks || null
      };

      const res = await fetch('/api/clerk/admission/students', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast.success('Student added successfully', { id: toastId });
      setSavedRollLocked(true);
      setShowAddForm(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      setBasic({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'+91', email:''});
      setPersonal({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', guardian_mobile:'+91', address:'', seat_allotted_category:'', identification_marks:'', ncc_nss_details:'' });
      setAcademic({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', total_marks:'', marks_secured:'' });
      setSavedRollLocked(false);
      setTimeout(()=>{ setShowAddForm(true); }, 1500);
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setAddLoading(false); }
  };

  // Fetch handlers
  const loadFullProfileByRoll = async (roll) => {
    setFetchError('');
    setFetchedStudent(null);
    try{
      const res = await fetch(`/api/student/${roll}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Student not found');
      const student = data.student;
      setFetchedStudent(student);
      const pd = student.personal_details || {};
      setPersonalFull({
        father_name: pd.father_name || student.father_name || '',
        mother_name: pd.mother_name || '',
        nationality: pd.nationality || '',
        religion: pd.religion || '',
        category: pd.category || student.category || 'OC',
        sub_caste: pd.sub_caste || '',
        area_status: pd.area_status || 'Local',
        mother_tongue: pd.mother_tongue || '',
        place_of_birth: pd.place_of_birth || '',
        father_occupation: pd.father_occupation || '',
        annual_income: pd.annual_income || '',
        aadhaar_no: pd.aadhaar_no || '',
        guardian_mobile: pd.guardian_mobile || pd.father_guardian_mobile_no || '',
        address: pd.address || student.address || '',
        seat_allotted_category: pd.seat_allotted_category || '',
        identification_marks: pd.identification_marks || '',
        ncc_nss_details: pd.ncc_nss_details || ''
      });

      const initialAcademics = Array.isArray(data.academics) ? data.academics : [];
      setAcademicsList(initialAcademics);
      setOriginalAcademicsList(JSON.parse(JSON.stringify(initialAcademics)));

      const initialFees = Array.isArray(data.fees) ? data.fees : [];
      setFeesList(initialFees);
      setFeeDetails(data.student_fee_details || null);

      const initialEdit = {
        admission_no: student.admission_no || null,
        roll_no: student.roll_no || null,
        name: student.name || null,
        date_of_birth: formatDate(student.date_of_birth) || null,
        gender: student.gender || 'Male',
        admission_type: getAdmissionTypeFromRoll(student.roll_no) || null,
        course: getBranchFromRoll(student.roll_no) || null,
        mobile: sanitizeDigits(student.mobile || '' , 10) || null,
        email: student.email || null,
        address: pd.address || student.address || null,
        guardian_mobile: sanitizeDigits(pd.guardian_mobile || pd.father_guardian_mobile_no || '', 10) || null,
        father_occupation: pd.father_occupation || null,
        annual_income: sanitizeDigits(pd.annual_income || '', 12) || null
      };
      setEditValues(initialEdit);
      setOriginalEditValues(JSON.parse(JSON.stringify(initialEdit)));

      const initialPersonal = {
        father_name: pd.father_name || student.father_name || null,
        mother_name: pd.mother_name || null,
        nationality: pd.nationality || null,
        religion: pd.religion || null,
        category: pd.category || student.category || 'OC',
        sub_caste: pd.sub_caste || null,
        area_status: pd.area_status || 'Local',
        mother_tongue: pd.mother_tongue || null,
        place_of_birth: pd.place_of_birth || null,
        father_occupation: pd.father_occupation || null,
        annual_income: pd.annual_income || null,
        aadhaar_no: pd.aadhaar_no || null,
        guardian_mobile: pd.guardian_mobile || pd.father_guardian_mobile_no || null,
        address: pd.address || student.address || null,
        seat_allotted_category: pd.seat_allotted_category || null,
        identification_marks: pd.identification_marks || null,
        ncc_nss_details: pd.ncc_nss_details || null
      };
      setPersonalFull(initialPersonal);
      setOriginalPersonalFull(JSON.parse(JSON.stringify(initialPersonal)));
      setSection('view');
    } catch(err){
      console.error('Load profile error:', err);
      setFetchError(err.message || 'Failed to load profile');
    }
  };

  const handleFetch = async () => {
    setFetchError('');
    setFetchedStudent(null);
    setFetchedList([]);
    if (!canFetch()) { setFetchError('Please enter at least one search field.'); return; }
    setFetchLoading(true);
    try{
      if (fetchRoll.trim()) { await loadFullProfileByRoll(fetchRoll.trim()); return; }
      const params = new URLSearchParams();
      if (fetchAdmission.trim()) params.set('admission_no', fetchAdmission.trim());
      if (fetchName.trim()) params.set('name', fetchName.trim());
      const res = await fetch(`/api/clerk/students/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Search failed');
      if (!data.students || data.students.length === 0) {
        setFetchError('No students found');
      } else if (data.students.length === 1) {
        await loadFullProfileByRoll(data.students[0].roll_no);
      } else {
        setFetchedList(data.students);
      }
    }catch(err){
      console.error(err);
      setFetchError(err.message || 'Fetch failed');
    }finally{ setFetchLoading(false); }
  };

  const handleSaveEdits = async () => {
    if (!fetchedStudent) return;
    setSaving(true);
    const toastId = toast.loading('Saving changes...');
    try { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} } catch (e) {}
    try{
      const roll = fetchedStudent.roll_no;
      const errors = [];
      const warnings = [];

      // 1) Update students core fields where API supports it
      try {
        const payload = {
          name: editValues.name || null,
          gender: editValues.gender || null,
          mobile: editValues.mobile || null,
          date_of_birth: editValues.date_of_birth || null
        };
        const resStu = await fetch(`/api/clerk/students/${roll}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const dStu = await resStu.json();
        if (!resStu.ok) errors.push(dStu.error || dStu.message || 'Failed to update student core details');
      } catch (e) { errors.push(e.message || 'Student update request failed'); }

      // 2) Update contact info via existing student update endpoint
      try {
        const updateProfile = { rollno: roll };
        if (editValues.mobile) updateProfile.phone = editValues.mobile;
        if (editValues.email) updateProfile.email = editValues.email;
        if (updateProfile.phone || updateProfile.email) {
          const res1 = await fetch('/api/student/update-profile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updateProfile)});
          const d1 = await res1.json();
          if (!res1.ok) errors.push(d1.error || 'Failed to update contact info');
        }
      } catch (e) { errors.push(e.message || 'Update-profile request failed'); }

      // 3) Persist personal details
      try {
        // Build personal payload that uses null for empty values to match DB schema
        const pdFields = ['father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','annual_income','aadhaar_no','guardian_mobile','address','seat_allotted_category','identification_marks','ncc_nss_details'];
        const personalPayload = { roll_no: roll };
        pdFields.forEach(f => { personalPayload[f] = personalFull[f] ? personalFull[f] : null; });
        const res2 = await fetch('/api/clerk/personal-details', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(personalPayload) });
        const d2 = await res2.json();
        if (!res2.ok) errors.push(d2.error || d2.message || 'Failed to save personal details');
      } catch (e) { errors.push(e.message || 'Personal-details request failed'); }

      // 4) Attempt to persist academics (best-effort). Skip if empty; treat 404 as a warning.
      try {
        if (academicsList && academicsList.length > 0) {
          const acadPayload = { roll_no: roll, academics: academicsList };
          const resA = await fetch('/api/clerk/academics', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(acadPayload) });
          if (resA.status === 404) {
            warnings.push('Academics endpoint not available; academic changes were not saved.');
          } else {
            const dA = await resA.json();
            if (!resA.ok) errors.push(dA.error || dA.message || 'Failed to save academics');
          }
        }
      } catch (e) { errors.push('Academics update request failed or endpoint missing'); }

      // Update local copy for immediate UX
      fetchedStudent.name = editValues.name || fetchedStudent.name;
      fetchedStudent.date_of_birth = editValues.date_of_birth || fetchedStudent.date_of_birth;
      fetchedStudent.gender = editValues.gender || fetchedStudent.gender;
      fetchedStudent.mobile = editValues.mobile || fetchedStudent.mobile;
      fetchedStudent.email = editValues.email || fetchedStudent.email;
      fetchedStudent.admission_no = editValues.admission_no || fetchedStudent.admission_no;
      
      fetchedStudent.personal_details = { ...(fetchedStudent.personal_details || {}), ...personalFull };

      if (errors.length === 0) {
        // Update originals so Save button hides after successful save
        setOriginalEditValues(JSON.parse(JSON.stringify(editValues)));
        setOriginalPersonalFull(JSON.parse(JSON.stringify(personalFull)));
        setOriginalAcademicsList(JSON.parse(JSON.stringify(academicsList)));

        if (warnings.length === 0) {
          toast.success('Saved changes successfully', { id: toastId });
        } else {
          toast.success('Saved changes (with warnings)', { id: toastId });
          toast('Warnings: ' + warnings.join(' | '));
        }
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      } else {
        toast.error('Save failed: ' + errors.join(' | '), { id: toastId });
      }
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setSaving(false); }
  };

  const hasEdits = () => {
    try {
      if (!originalEditValues && !originalPersonalFull && !originalAcademicsList) return false;
      if (originalEditValues && JSON.stringify(originalEditValues) !== JSON.stringify(editValues)) return true;
      if (originalPersonalFull && JSON.stringify(originalPersonalFull) !== JSON.stringify(personalFull)) return true;
      if (originalAcademicsList && JSON.stringify(originalAcademicsList) !== JSON.stringify(academicsList)) return true;
      return false;
    } catch (e) { return false; }
  };

  const genders = ['Male', 'Female'];
  const categories = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Student Management</h2>
      <div className="flex space-x-2 mb-4">
        <button onClick={()=>setSection('add')} className={`px-3 py-2 rounded ${section==='add'?'bg-indigo-600 text-white':'bg-gray-100'} cursor-pointer`}>Add New Student</button>
        <button onClick={()=>setSection('fetch')} className={`px-3 py-2 rounded ${section==='fetch'?'bg-indigo-600 text-white':'bg-gray-100'} cursor-pointer`}>Fetch Student</button>
        <button onClick={()=>setSection('view')} disabled={!fetchedStudent} className={`px-3 py-2 rounded ${section==='view'?'bg-indigo-600 text-white':'bg-gray-100'} ${!fetchedStudent?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>View / Edit Student</button>
      </div>

      {/* Sections */}
      {section==='add' ? (
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
              <input placeholder="Annual Income" value={personal.annual_income} onChange={e=>setPersonal({...personal, annual_income:e.target.value})} type="number" className="p-2 border rounded" />
              <input placeholder="Aadhaar Number" value={personal.aadhaar_no} onChange={e=>setPersonal({...personal, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" maxLength={14} />
          </div>
          </div>
                <textarea placeholder="Address" value={personal.address} onChange={e=>setPersonal({...personal, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
          <div>
                <textarea placeholder="Identification Marks (optional)" value={personal.identification_marks} onChange={e=>setPersonal({...personal, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <select value={academic.qualifying_exam} onChange={e=>setAcademic({...academic, qualifying_exam:e.target.value})} className="p-2 border rounded"><option>EAMCET</option><option>ECET</option><option>PGECET</option></select>
              <textarea placeholder="Previous College Details" value={academic.previous_college_details} onChange={e=>setAcademic({...academic, previous_college_details:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" rows={3} style={{overflow:'hidden'}} />
              <select value={academic.medium_of_instruction} onChange={e=>setAcademic({...academic, medium_of_instruction:e.target.value})} className="p-2 border rounded"><option>Telugu</option><option>English</option><option>Other</option></select>
              
              <input placeholder="Total Marks" type="number" value={academic.total_marks} onChange={e=>setAcademic({...academic, total_marks:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Marks Secured" type="number" value={academic.marks_secured} onChange={e=>setAcademic({...academic, marks_secured:e.target.value})} className="p-2 border rounded" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={!addRequiredFilled() || addLoading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">{addLoading? 'Saving...':'Save'}</button>
          </div>
        </form>
        ) : (
          <div className="p-4 bg-green-50 text-green-800 rounded">Data added to Database</div>
        )
      ) : null }

      {section==='fetch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Roll Number" value={fetchRoll} onChange={e=>setFetchRoll(e.target.value)} className="p-2 border rounded" />
            <input placeholder="Admission Number" value={fetchAdmission} onChange={e=>setFetchAdmission(e.target.value)} className="p-2 border rounded" />
            <input placeholder="Student Name" value={fetchName} onChange={e=>setFetchName(e.target.value)} className="p-2 border rounded" />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleFetch}
              disabled={!canFetch() || fetchLoading}
              className={`px-4 py-2 bg-green-600 text-white rounded ${(!canFetch() || fetchLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-green-300 transition duration-150'}`}
            >
              {fetchLoading? 'Fetching...':'Fetch'}
            </button>
            <button onClick={()=>{setFetchRoll(''); setFetchAdmission(''); setFetchName(''); setFetchError('');}} className="px-4 py-2 bg-gray-100 rounded">Clear</button>
          </div>
          {fetchError && <div className="text-red-600">{fetchError}</div>}
          {fetchedList && fetchedList.length > 1 && (
            <div className="mt-3 bg-gray-50 p-3 rounded">
              <div className="text-sm font-medium mb-2">Multiple results — click to open</div>
              <div className="space-y-2">
                {fetchedList.map(s => (
                  <div key={s.roll_no} className="flex items-center justify-between p-2 bg-white rounded shadow-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">Roll: {s.roll_no} • Adm: {s.admission_no || 'N/A'}</div>
                    </div>
                    <button onClick={()=>loadFullProfileByRoll(s.roll_no)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm cursor-pointer hover:shadow-sm transition">Open</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section==='view' && (
        <div>
          {!fetchedStudent && <div className="text-gray-600">No student loaded. Use Fetch to load a student.</div>}
          {fetchedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 bg-gray-50 p-4 rounded">
                  <h4 className="font-semibold mb-3">Profile</h4>
                  <div className="w-28 h-28 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center">
                    {fetchedStudent.pfp ? (
                      <Image src={fetchedStudent.pfp} alt="Profile" width={112} height={112} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-500">No Photo</div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{fetchedStudent.name}</div>
                    <div className="text-xs text-gray-600 mt-1">Admission No: {fetchedStudent.admission_no || 'N/A'}</div>
                    <div className="text-xs text-gray-600">DOB: {formatDate(fetchedStudent.date_of_birth)}</div>
                    <div className="text-xs text-gray-600">Course: {getBranchFromRoll(fetchedStudent.roll_no) || 'N/A'}</div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white p-4 rounded shadow">
                  {/* Section A: Basic Details */}
                  <h4 className="font-semibold mb-2">Section A: Basic Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <input placeholder="Admission Number" value={editValues.admission_no || ''} onChange={e=>setEditValues({...editValues, admission_no:e.target.value})} className="p-2 border rounded" />
                    <div className="relative">
                      <input placeholder="Roll Number" value={editValues.roll_no || ''} disabled className="p-2 border rounded w-full bg-gray-100" />
                      <span title="Roll number cannot be edited" className="absolute right-2 top-2 text-sm">🔒</span>
                    </div>
                    <input placeholder="Student Name" value={editValues.name || ''} onChange={e=>setEditValues({...editValues, name:e.target.value})} className="p-2 border rounded" />
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
                    <select value={editValues.gender || 'Male'} onChange={e=>setEditValues({...editValues, gender:e.target.value})} className="p-2 border rounded">
                      {genders.map(g=> <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input placeholder="Course" value={getBranchFromRoll(editValues.roll_no) || ''} disabled className="p-2 border rounded bg-gray-100" />
                    <div className="relative">
                      <input placeholder="Admission Type" value={editValues.admission_type || ''} disabled className="p-2 border rounded w-full bg-gray-100" />
                      <span title="Admission Type cannot be changed after admission." className="absolute right-2 top-2 text-sm">🔒</span>
                    </div>
                    <input placeholder="Mobile Number" value={editValues.mobile || ''} onChange={e=>setEditValues({...editValues, mobile: sanitizeDigits(e.target.value, 10)})} className="p-2 border rounded" />
                    <input type="email" placeholder="Email" value={editValues.email || ''} onChange={e=>setEditValues({...editValues, email:e.target.value})} className="p-2 border rounded" />
                    <div className="col-span-1 md:col-span-3 text-sm text-gray-500">Profile Picture is view-only here.</div>
                  </div>

                  {/* Section B: Personal Details */}
                  <h4 className="font-semibold mb-2">Section B: Personal Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <input placeholder="Father Name" value={personalFull.father_name || ''} onChange={e=>setPersonalFull({...personalFull, father_name:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Mother Name" value={personalFull.mother_name || ''} onChange={e=>setPersonalFull({...personalFull, mother_name:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Nationality" value={personalFull.nationality || ''} onChange={e=>setPersonalFull({...personalFull, nationality:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Religion" value={personalFull.religion || ''} onChange={e=>setPersonalFull({...personalFull, religion:e.target.value})} className="p-2 border rounded" />
                    <select value={personalFull.category || 'OC'} onChange={e=>setPersonalFull({...personalFull, category:e.target.value})} className="p-2 border rounded">{categories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
                    <input placeholder="Sub Caste" value={personalFull.sub_caste || ''} onChange={e=>setPersonalFull({...personalFull, sub_caste:e.target.value})} className="p-2 border rounded" />
                    <select value={personalFull.area_status || 'Local'} onChange={e=>setPersonalFull({...personalFull, area_status:e.target.value})} className="p-2 border rounded"><option>Local</option><option>Non-Local</option></select>
                    <input placeholder="Mother Tongue" value={personalFull.mother_tongue || ''} onChange={e=>setPersonalFull({...personalFull, mother_tongue:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Place of Birth" value={personalFull.place_of_birth || ''} onChange={e=>setPersonalFull({...personalFull, place_of_birth:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Father Occupation" value={personalFull.father_occupation || ''} onChange={e=>setPersonalFull({...personalFull, father_occupation:e.target.value})} className="p-2 border rounded" />
                    <input placeholder="Annual Income" type="number" value={personalFull.annual_income || ''} onChange={e=>setPersonalFull({...personalFull, annual_income: sanitizeDigits(e.target.value, 12)})} className="p-2 border rounded" />
                    <input placeholder="Aadhaar Number" value={personalFull.aadhaar_no || ''} onChange={e=>setPersonalFull({...personalFull, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" />
                    <input placeholder="Guardian Mobile" value={personalFull.guardian_mobile || ''} onChange={e=>setPersonalFull({...personalFull, guardian_mobile: sanitizeDigits(e.target.value,10)})} className="p-2 border rounded" />
                    <textarea placeholder="Address" value={personalFull.address || ''} onChange={e=>setPersonalFull({...personalFull, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" />
                    <input placeholder="Seat Allotted Category" value={personalFull.seat_allotted_category || ''} onChange={e=>setPersonalFull({...personalFull, seat_allotted_category:e.target.value})} className="p-2 border rounded" />
                    <textarea placeholder="Identification Marks" value={personalFull.identification_marks || ''} onChange={e=>setPersonalFull({...personalFull, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-20 resize-none" />
                    <textarea placeholder="NCC / NSS Details" value={personalFull.ncc_nss_details || ''} onChange={e=>setPersonalFull({...personalFull, ncc_nss_details:e.target.value})} className="p-2 border rounded md:col-span-3 h-20 resize-none" />
                  </div>
                </div>
              </div>

              {/* Section C: Academic Background */}
              <div className="bg-white p-4 rounded shadow">
                <h4 className="font-semibold mb-2">Section C: Academic Background</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={(academicsList[0] && academicsList[0].qualifying_exam) || 'EAMCET'} onChange={e=>{ const copy = [...academicsList]; copy[0] = {...(copy[0]||{}), qualifying_exam: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded">
                    <option>EAMCET</option>
                    <option>ECET</option>
                    <option>PGECET</option>
                  </select>
                  <textarea placeholder="Previous College Details" value={(academicsList[0] && academicsList[0].previous_college_details) || ''} onChange={e=>{ const copy = [...academicsList]; copy[0] = {...(copy[0]||{}), previous_college_details: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded md:col-span-3 h-20 resize-none" />
                  <select value={(academicsList[0] && academicsList[0].medium_of_instruction) || 'English'} onChange={e=>{ const copy=[...academicsList]; copy[0] = {...(copy[0]||{}), medium_of_instruction: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded"><option>English</option><option>Telugu</option><option>Other</option></select>
                  
                  <input placeholder="Total Marks" type="number" value={(academicsList[0] && academicsList[0].total_marks) || ''} onChange={e=>{ const copy=[...academicsList]; copy[0] = {...(copy[0]||{}), total_marks: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded" />
                  <input placeholder="Marks Secured" type="number" value={(academicsList[0] && academicsList[0].marks_secured) || ''} onChange={e=>{ const copy=[...academicsList]; copy[0] = {...(copy[0]||{}), marks_secured: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded" />
                </div>
              </div>

              {/* Section D: Fee Summary (read-only) */}
              <div className="bg-white p-4 rounded shadow">
                <h4 className="font-semibold mb-2">Section D: Fee Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-2 border rounded">
                    <div className="text-xs text-gray-500">Total Fee</div>
                    <div className="font-medium">{feeDetails && feeDetails.total_fee ? feeDetails.total_fee : 'N/A'}</div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="text-xs text-gray-500">Total Paid</div>
                    <div className="font-medium">{feesList && feesList.length ? feesList.reduce((s,f)=>s+Number(f.amount||0),0) : '0'}</div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="text-xs text-gray-500">Pending Fee</div>
                    <div className="font-medium">{feeDetails && feeDetails.pending_fee ? feeDetails.pending_fee : 'N/A'}</div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="text-xs text-gray-500">Last Payment Date</div>
                    <div className="font-medium">{feesList && feesList.length ? formatDate(feesList[feesList.length-1].date) : (feeDetails && feeDetails.last_payment_date ? formatDate(feeDetails.last_payment_date) : 'N/A')}</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button onClick={()=>{setFetchedStudent(null); setSection('fetch');}} className="px-3 py-2 bg-gray-100 rounded cursor-pointer hover:shadow-sm transition">Back</button>
                  {hasEdits() && (
                    <button onClick={handleSaveEdits} disabled={saving} className={`px-4 py-2 bg-indigo-600 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md transition'}`}>{saving? 'Saving...':'Save Changes'}</button>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
