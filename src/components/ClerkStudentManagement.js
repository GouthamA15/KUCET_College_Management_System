"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import Image from 'next/image';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { validateRollNo, getBranchFromRoll, getAdmissionTypeFromRoll, getEntranceExamQualified } from '@/lib/rollNumber';
import BulkImportStudents from '@/components/BulkImportStudents';


const DatePickerInput = forwardRef(({ value, onClick, ...props }, ref) => (
  <input
    onClick={onClick}
    ref={ref}
    value={value ?? ''}
    {...props}
  />
));
DatePickerInput.displayName = 'DatePickerInput';

export default function ClerkStudentManagement() {
  const [activeAction, setActiveAction] = useState(null); // null | 'add' | 'import' | 'fetch' | 'view'
  
  // Clear residual UI artifacts when closing content area
  useEffect(() => {
    if (activeAction === null) {
      // No specific cleanup needed for BulkImportStudents as it manages its own display
    }
  }, [activeAction]);

  // Add New Student form state
  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', mobile:'+91', email:'' });
  const [personal, setPersonal] = useState({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', address:'', seat_allotted_category:'', identification_marks:'' });
  const [academic, setAcademic] = useState({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', ranks:'' });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [rollNoError, setRollNoError] = useState('');
  const [isQualifyingExamAutofilled, setIsQualifyingExamAutofilled] = useState(false);
  const [isTotalMarksAutofilled, setIsTotalMarksAutofilled] = useState(false);

  // Fetch state
  const [fetchRoll, setFetchRoll] = useState('');
  const [fetchAdmission, setFetchAdmission] = useState('');
  const [fetchName, setFetchName] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchedStudent, setFetchedStudent] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [fetchedList, setFetchedList] = useState([]);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);

  // View/Edit state
  const [editValues, setEditValues] = useState({ address:'', mobile:'', email:'', father_occupation:'', annual_income:'' });
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

  // Scroll to top whenever user toggles actions
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }, [activeAction]);

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
        address: pd.address || student.address || '',
        seat_allotted_category: pd.seat_allotted_category || '',
        identification_marks: pd.identification_marks || ''
      });

      const initialAcademics = Array.isArray(data.academics) ? data.academics : [];
      let currentQualifyingExam = initialAcademics.length > 0 ? initialAcademics[0].qualifying_exam : '';
      let currentRanks = initialAcademics.length > 0 ? initialAcademics[0].ranks : '';

      let isQualifyingExamDerived = false;
      // ranks is not autofilled from roll number, so no 'isTotalMarksDerived' equivalent for it.

      if (!currentQualifyingExam) {
        currentQualifyingExam = getEntranceExamQualified(student.roll_no) || 'EAMCET';
        isQualifyingExamDerived = true;
      }
      // No autofill logic for ranks

      if (initialAcademics.length === 0) {
        initialAcademics.push({ qualifying_exam: currentQualifyingExam, ranks: currentRanks });
      } else {
        initialAcademics[0] = { ...initialAcademics[0], qualifying_exam: currentQualifyingExam, ranks: currentRanks };
      }
      setAcademicsList(initialAcademics);
      setOriginalAcademicsList(JSON.parse(JSON.stringify(initialAcademics)));
      setIsQualifyingExamAutofilled(isQualifyingExamDerived);
      setIsTotalMarksAutofilled(false); // Ranks is not autofilled

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
        address: pd.address || student.address || null,
        seat_allotted_category: pd.seat_allotted_category || null,
        identification_marks: pd.identification_marks || null
      };
      setPersonalFull(initialPersonal);
      setOriginalPersonalFull(JSON.parse(JSON.stringify(initialPersonal)));
      setActiveAction('view');
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
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}

    try {
      const roll = fetchedStudent.roll_no;

      const updatedData = {
        // Basic Details (from editValues)
        name: editValues.name,
        admission_no: editValues.admission_no,
        date_of_birth: editValues.date_of_birth,
        gender: editValues.gender,
        mobile: editValues.mobile,
        email: editValues.email,

        // Personal Details (from personalFull)
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
        annual_income: personalFull.annual_income,
        aadhaar_no: personalFull.aadhaar_no,
        address: personalFull.address,
        seat_allotted_category: personalFull.seat_allotted_category,
        identification_marks: personalFull.identification_marks,

        // Academic Background (from academicsList[0])
        qualifying_exam: academicsList[0]?.qualifying_exam,
        previous_college_details: academicsList[0]?.previous_college_details,
        medium_of_instruction: academicsList[0]?.medium_of_instruction,
        ranks: academicsList[0]?.ranks,
      };

      const res = await fetch(`/api/clerk/admission/students/${roll}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student details');
      }

      toast.success('Saved changes successfully', { id: toastId });

      // After successful save, refresh the student data to ensure UI reflects latest DB state
      await loadFullProfileByRoll(roll);

      // Reset original values to hide Save button
      setOriginalEditValues(JSON.parse(JSON.stringify(editValues)));
      setOriginalPersonalFull(JSON.parse(JSON.stringify(personalFull)));
      setOriginalAcademicsList(JSON.parse(JSON.stringify(academicsList)));

    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    } finally {
      setSaving(false);
    }
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
        <button onClick={()=>setActiveAction(prev => (prev === 'add' ? null : 'add'))} className={`px-3 py-2 rounded ${activeAction==='add'?'bg-indigo-600 text-white':'bg-gray-100'} cursor-pointer`}>Add New Student</button>
        <button onClick={()=>setActiveAction(prev => (prev === 'import' ? null : 'import'))} className={`px-3 py-2 rounded ${activeAction==='import'?'bg-indigo-600 text-white':'bg-gray-100'} cursor-pointer`}>Import From Excel</button>
        <button onClick={()=>setActiveAction(prev => (prev === 'fetch' ? null : 'fetch'))} className={`px-3 py-2 rounded ${activeAction==='fetch'?'bg-indigo-600 text-white':'bg-gray-100'} cursor-pointer`}>Fetch Student</button>
        <button onClick={()=>{ if (fetchedStudent) setActiveAction(prev => (prev === 'view' ? null : 'view')); }} disabled={!fetchedStudent} className={`px-3 py-2 rounded ${activeAction==='view'?'bg-indigo-600 text-white':'bg-gray-100'} ${!fetchedStudent?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>View / Edit Student</button>
      </div>

      {/* Sections */}
      {activeAction==='add' ? (
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
      ) : null }

      {activeAction==='fetch' && (
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

      {activeAction==='import' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Upload a .xlsx or .xls file to add multiple students at once.</p>
          {/* Inline Bulk Import Component */}
          <BulkImportStudents
            onReset={() => {}}
            onImportSuccess={(payload) => {
              // The BulkImportStudents component now handles its own display of import results and errors.
              // This callback can be used for any parent-level side effects if needed.
            }}
          />
        </div>
      )}

      {activeAction==='view' && (
        <div>
          {!fetchedStudent && <div className="text-gray-600">No student loaded. Use Fetch to load a student.</div>}
          {fetchedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 bg-gray-50 p-4 rounded">
                  <h4 className="font-semibold mb-3">Profile</h4>
                  <div className="w-28 h-28 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center">
                    {(() => {
                      const p = fetchedStudent.pfp;
                      const has = p && String(p).trim() !== '';
                      const isData = has && String(p).startsWith('data:');
                      const dataHasBody = !isData || (String(p).includes(',') && String(p).split(',')[1].trim() !== '');
                      if (has && dataHasBody) {
                        return <Image src={String(p)} alt="Profile" width={112} height={112} onClick={(e) => { e.stopPropagation(); setImagePreviewSrc(String(p)); setImagePreviewOpen(true); }} className="w-full h-full object-cover cursor-pointer" />;
                      }
                      return <div className="text-gray-500">No Photo</div>;
                    })()}
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
                    <div className="col-span-1 md:col-span-3 text-sm text-gray-500">Profile Picture is view-only here. Inform Students to Upload their Profile Picture Through Their Student Login.</div>
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
                    <input placeholder="Annual Income" value={personalFull.annual_income || ''} onChange={e=>setPersonalFull({...personalFull, annual_income:e.target.value})} type="number" className="p-2 border rounded" />
                    <input placeholder="Aadhaar Number" value={personalFull.aadhaar_no || ''} onChange={e=>setPersonalFull({...personalFull, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" />

                    <textarea placeholder="Address" value={personalFull.address || ''} onChange={e=>setPersonalFull({...personalFull, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" />
                    <input placeholder="Seat Allotted Category" value={personalFull.seat_allotted_category || ''} onChange={e=>setPersonalFull({...personalFull, seat_allotted_category:e.target.value})} className="p-2 border rounded" />
                    <textarea placeholder="Identification Marks" value={personalFull.identification_marks || ''} onChange={e=>setPersonalFull({...personalFull, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-20 resize-none" />

                  </div>
                </div>
              </div>

              {/* Section C: Academic Background */}
              <div className="bg-white p-4 rounded shadow">
                <h4 className="font-semibold mb-2">Section C: Academic Background</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={(academicsList[0] && academicsList[0].qualifying_exam) || 'EAMCET'}
                    onChange={e=>{ const copy = [...academicsList]; copy[0] = {...(copy[0]||{}), qualifying_exam: e.target.value}; setAcademicsList(copy); }}
                    disabled={isQualifyingExamAutofilled}
                    className={`p-2 border rounded ${isQualifyingExamAutofilled ? 'bg-gray-100' : ''}`}
                  >
                    <option>EAMCET</option>
                    <option>ECET</option>
                    <option>PGECET</option>
                  </select>
                  <textarea placeholder="Previous College Details" value={(academicsList[0] && academicsList[0].previous_college_details) || ''} onChange={e=>{ const copy = [...academicsList]; copy[0] = {...(copy[0]||{}), previous_college_details: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded md:col-span-3 h-20 resize-none" />
                  <select value={(academicsList[0] && academicsList[0].medium_of_instruction) || 'English'} onChange={e=>{ const copy=[...academicsList]; copy[0] = {...(copy[0]||{}), medium_of_instruction: e.target.value}; setAcademicsList(copy); }} className="p-2 border rounded"><option>English</option><option>Telugu</option><option>Other</option></select>
                  
                  <input
                    placeholder="Rank"
                    type="number"
                    value={academicsList[0]?.ranks || ''}
                    onChange={e=>{ const copy=[...academicsList]; copy[0] = {...(copy[0]||{}), ranks: e.target.value}; setAcademicsList(copy); }}
                    className="p-2 border rounded"
                  />
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
                <button onClick={()=>{ setActiveAction(null); }} className="px-3 py-2 bg-gray-100 rounded cursor-pointer hover:shadow-sm transition">Collapse</button>
                  {hasEdits() && (
                    <button onClick={handleSaveEdits} disabled={saving} className={`px-4 py-2 bg-indigo-600 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md transition'}`}>{saving? 'Saving...':'Save Changes'}</button>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}