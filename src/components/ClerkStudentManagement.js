"use client";
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';

const courses = ['CSE','CSD','IT','EEE','ECE','CIVIL','MECH'];
const genders = ['Male','Female'];
const categories = ['OC','BC-A','BC-B','BC-C','BC-D','BC-E','SC','ST','EWS'];

export default function ClerkStudentManagement() {
  const [section, setSection] = useState('home'); // 'add','fetch','view'

  // Add New Student form state
  const [basic, setBasic] = useState({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', course:'CSE', mobile:'+91', email:'' });
  const [personal, setPersonal] = useState({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', guardian_mobile:'+91', address:'', seat_allotted_category:'', identification_marks:'', ncc_nss_details:'' });
  const [academic, setAcademic] = useState({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', year_of_study:'1', total_marks:'', marks_secured:'' });
  const [addLoading, setAddLoading] = useState(false);
  const [savedRollLocked, setSavedRollLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);

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
  const [saving, setSaving] = useState(false);
  const [originalEditValues, setOriginalEditValues] = useState(null);

  // Validation helpers
  const addRequiredFilled = () => {
    return basic.admission_no.trim() && basic.roll_no.trim() && basic.name.trim() && basic.date_of_birth && basic.gender && basic.course && basic.mobile.trim() && basic.email.trim();
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!addRequiredFilled()) return;
    setAddLoading(true);
    const toastId = toast.loading('Saving new student...');
    try{
      // Compose payload aligned with existing admission API
      const payload = {
        admission_no: basic.admission_no,
        roll_no: basic.roll_no,
        name: basic.name,
        father_name: personal.father_name,
        mother_name: personal.mother_name,
        date_of_birth: basic.date_of_birth,
        place_of_birth: personal.place_of_birth,
        gender: basic.gender,
        nationality: personal.nationality,
        religion: personal.religion,
        caste: personal.sub_caste,
        sub_caste: personal.sub_caste,
        category: personal.category,
        address: personal.address,
        mobile: basic.mobile,
        email: basic.email,
        qualifying_exam: academic.qualifying_exam,
        course: basic.course,
        branch: basic.course,
        mother_tongue: personal.mother_tongue,
        father_occupation: personal.father_occupation,
        annual_income: personal.annual_income,
        student_aadhar_no: personal.aadhaar_no,
        father_guardian_mobile_no: personal.guardian_mobile,
        identification_marks: personal.identification_marks,
        present_address: personal.address,
        permanent_address: personal.address,
        admission_type: 'regular'
      };

      const res = await fetch('/api/clerk/admission/students', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast.success('Student added successfully', { id: toastId });
      setSavedRollLocked(true);
      // hide form, clear fields, scroll to top, then show form again
      setShowAddForm(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      // clear fields
      setBasic({ admission_no:'', roll_no:'', name:'', date_of_birth:'', gender:'Male', course:'CSE', mobile:'+91', email:'' });
      setPersonal({ father_name:'', mother_name:'', nationality:'', religion:'', category:'OC', sub_caste:'', area_status:'Local', mother_tongue:'', place_of_birth:'', father_occupation:'', annual_income:'', aadhaar_no:'', guardian_mobile:'+91', address:'', seat_allotted_category:'', identification_marks:'', ncc_nss_details:'' });
      setAcademic({ qualifying_exam:'EAMCET', previous_college_details:'', medium_of_instruction:'English', year_of_study:'1', total_marks:'', marks_secured:'' });
      setSavedRollLocked(false);
      setTimeout(()=>{ setShowAddForm(true); }, 1500);
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setAddLoading(false); }
  };

  const canFetch = () => {
    return fetchRoll.trim() || fetchAdmission.trim() || fetchName.trim();
  };

  const handleFetch = async () => {
    setFetchError('');
    setFetchedStudent(null);
    setFetchedList([]);
    if (!canFetch()) { setFetchError('Please enter at least one search field.'); return; }
    setFetchLoading(true);
    try{
      // If roll provided, fetch full profile
      if (fetchRoll.trim()) {
        await loadFullProfileByRoll(fetchRoll.trim());
        return;
      }

      // Search by admission_no or name via new clerk search endpoint
      const params = new URLSearchParams();
      if (fetchAdmission.trim()) params.set('admission_no', fetchAdmission.trim());
      if (fetchName.trim()) params.set('name', fetchName.trim());
      const res = await fetch(`/api/clerk/students/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Search failed');
      if (!data.students || data.students.length === 0) {
        setFetchError('No students found');
      } else if (data.students.length === 1) {
        // Load full profile by roll_no
        await loadFullProfileByRoll(data.students[0].roll_no);
      } else {
        // multiple results - show list to pick
        setFetchedList(data.students);
        setSection('view');
      }
    }catch(err){
      console.error(err);
      setFetchError(err.message || 'Fetch failed');
    }finally{ setFetchLoading(false); }
  };

  const loadFullProfileByRoll = async (roll) => {
    setFetchError('');
    setFetchedStudent(null);
    try{
      const res = await fetch(`/api/student/${roll}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Student not found');
      // server now returns student.personal_details
      const student = data.student;
      setFetchedStudent(student);
      const pd = student.personal_details || {};
      setEditValues({
        address: pd.address || student.address || '',
        mobile: sanitizeDigits(student.mobile || '' , 10),
        email: student.email || '',
        guardian_mobile: sanitizeDigits(pd.guardian_mobile || pd.father_guardian_mobile_no || '', 10),
        father_occupation: pd.father_occupation || '',
        annual_income: sanitizeDigits(pd.annual_income || '', 12)
      });
      // remember original values to detect edits
      setOriginalEditValues({
        address: pd.address || student.address || '',
        mobile: sanitizeDigits(student.mobile || '' , 10),
        email: student.email || '',
        guardian_mobile: sanitizeDigits(pd.guardian_mobile || pd.father_guardian_mobile_no || '', 10),
        father_occupation: pd.father_occupation || '',
        annual_income: sanitizeDigits(pd.annual_income || '', 12)
      });
      setSection('view');
    }catch(err){
      console.error('Load profile error:', err);
      setFetchError(err.message || 'Failed to load profile');
    }
  };

  const handleSaveEdits = async () => {
    if (!fetchedStudent) return;
    setSaving(true);
    const toastId = toast.loading('Saving changes...');
    try{
      // Save mobile/email via existing API
      const updatePayload = { rollno: fetchedStudent.roll_no };
      const fetchedMobileSan = sanitizeDigits(fetchedStudent.mobile || '', 10);
      if (editValues.mobile && editValues.mobile !== fetchedMobileSan) updatePayload.phone = editValues.mobile;
      if (editValues.email && editValues.email !== fetchedStudent.email) updatePayload.email = editValues.email;
      if (updatePayload.phone || updatePayload.email) {
        const res1 = await fetch('/api/student/update-profile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updatePayload)});
        const d1 = await res1.json();
        if (!res1.ok) throw new Error(d1.error || 'Failed to update basic contact info');
      }

      // Persist other personal details via new endpoint
      const personalPayload = {
        roll_no: fetchedStudent.roll_no,
        guardian_mobile: editValues.guardian_mobile,
        father_occupation: editValues.father_occupation,
        annual_income: editValues.annual_income,
        address: editValues.address,
        identification_marks: fetchedStudent.personal_details ? fetchedStudent.personal_details.identification_marks : null,
      };
      const res2 = await fetch('/api/clerk/personal-details', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(personalPayload) });
      const d2 = await res2.json();
      if (!res2.ok) throw new Error(d2.error || d2.message || 'Failed to save personal details');

      // update local copies to reflect saved state
      if (editValues.mobile) fetchedStudent.mobile = editValues.mobile;
      if (editValues.email) fetchedStudent.email = editValues.email;
      fetchedStudent.personal_details = fetchedStudent.personal_details || {};
      fetchedStudent.personal_details.guardian_mobile = personalPayload.guardian_mobile;
      fetchedStudent.personal_details.father_occupation = personalPayload.father_occupation;
      fetchedStudent.personal_details.annual_income = personalPayload.annual_income;
      fetchedStudent.personal_details.address = personalPayload.address;

      // reset original comparison baseline
      setOriginalEditValues({ ...editValues });

      toast.success('Saved changes successfully', { id: toastId });
    }catch(err){
      console.error(err);
      toast.error(err.message || 'Save failed', { id: toastId });
    }finally{ setSaving(false); }
  };

  const hasEdits = () => {
    if (!originalEditValues) return false;
    try {
      return JSON.stringify(originalEditValues) !== JSON.stringify(editValues);
    } catch (e) { return false; }
  };

  const formatDate = (input) => {
    if (!input) return '';
    try {
      const date = new Date(input);
      if (isNaN(date.getTime())) {
        return input; // Return original input if it's not a valid date
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return input; // Return original input in case of an error
    }
  };

  const sanitizeDigits = (input, maxLen = 10) => {
    if (input == null) return '';
    const s = String(input).replace(/\D/g, '');
    return s.slice(0, maxLen);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Student Management</h2>
      <div className="flex space-x-2 mb-4">
        <button onClick={()=>setSection('add')} className={`px-3 py-2 rounded ${section==='add'?'bg-indigo-600 text-white':'bg-gray-100'}`}>Add New Student</button>
        <button onClick={()=>setSection('fetch')} className={`px-3 py-2 rounded ${section==='fetch'?'bg-indigo-600 text-white':'bg-gray-100'}`}>Fetch Student</button>
        <button onClick={()=>setSection('view')} disabled={!fetchedStudent} className={`px-3 py-2 rounded ${section==='view'?'bg-indigo-600 text-white':'bg-gray-100'} ${!fetchedStudent?'opacity-50 cursor-not-allowed':''}`}>View / Edit Student</button>
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
                {savedRollLocked && (<span className="absolute right-2 top-2 text-sm">🔒</span>)}
              </div>
              <input placeholder="Student Name*" value={basic.name} onChange={e=>setBasic({...basic, name:e.target.value})} className="p-2 border rounded" />
              <input type="date" value={basic.date_of_birth} onChange={e=>setBasic({...basic, date_of_birth:e.target.value})} className="p-2 border rounded" />
              <select value={basic.gender} onChange={e=>setBasic({...basic, gender:e.target.value})} className="p-2 border rounded">
                {genders.map(g=> <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={basic.course} onChange={e=>setBasic({...basic, course:e.target.value})} className="p-2 border rounded">
                {courses.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
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
              <input placeholder="Aadhaar Number" value={personal.aadhaar_no} onChange={e=>{
                const digits = (e.target.value || '').replace(/\D/g,'').slice(0,12);
                const groups = [];
                if (digits.length > 0) groups.push(digits.slice(0,4));
                if (digits.length > 4) groups.push(digits.slice(4,8));
                if (digits.length > 8) groups.push(digits.slice(8,12));
                const formatted = groups.join(' ');
                setPersonal({...personal, aadhaar_no: formatted});
              }} className="p-2 border rounded" maxLength={14} />
          </div>
          </div>
                <textarea placeholder="Address" value={personal.address} onChange={e=>setPersonal({...personal, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
          <div>
                <textarea placeholder="Identification Marks (optional)" value={personal.identification_marks} onChange={e=>setPersonal({...personal, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" style={{overflow: 'hidden'}} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <select value={academic.qualifying_exam} onChange={e=>setAcademic({...academic, qualifying_exam:e.target.value})} className="p-2 border rounded"><option>EAMCET</option><option>ECET</option><option>PGECET</option></select>
              <textarea placeholder="Previous College Details" value={academic.previous_college_details} onChange={e=>setAcademic({...academic, previous_college_details:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" rows={3} style={{overflow:'hidden'}} />
              <select value={academic.medium_of_instruction} onChange={e=>setAcademic({...academic, medium_of_instruction:e.target.value})} className="p-2 border rounded"><option>Telugu</option><option>English</option><option>Other</option></select>
              <div>
                <label className="block text-xs text-gray-600">Year of Study (1-4)</label>
                <input placeholder="Year of Study" type="number" min={1} max={10} value={academic.year_of_study} onChange={e=>setAcademic({...academic, year_of_study:e.target.value})} className="p-2 border rounded mt-1 w-full" />
              </div>
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
            <button onClick={handleFetch} disabled={!canFetch() || fetchLoading} className="px-4 py-2 bg-green-600 text-white rounded">{fetchLoading? 'Fetching...':'Fetch'}</button>
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
                    <button onClick={()=>loadFullProfileByRoll(s.roll_no)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Open</button>
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
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 bg-gray-50 p-4 rounded flex flex-col items-center">
                <h4 className="font-semibold mb-3">Profile</h4>
                <div className="w-28 h-28 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center">
                  {fetchedStudent.pfp ? (
                    <Image src={fetchedStudent.pfp} alt="Profile" width={112} height={112} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-500">No Photo</div>
                  )}
                </div>
                <div className="w-full text-sm text-left">
                  <div className="font-medium">{fetchedStudent.name}</div>
                  <div className="text-xs text-gray-600 mt-1">Roll No: {fetchedStudent.roll_no} <button onClick={()=>alert('Roll number change requires Principal approval.')} className="ml-2 text-xs text-yellow-700">⚠️ Edit</button></div>
                  <div className="text-xs text-gray-600">Admission No: {fetchedStudent.admission_no}</div>
                  <div className="text-xs text-gray-600">DOB: {formatDate(fetchedStudent.date_of_birth)}</div>
                  <div className="text-xs text-gray-600">Course: {fetchedStudent.course || 'N/A'}</div>
                </div>
              </div>
              <div className="md:col-span-2 bg-white p-4 rounded shadow">
                <h4 className="font-semibold mb-2">Contact & Personal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm">Mobile</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="\d{10}"
                      maxLength={10}
                      value={editValues.mobile}
                      onChange={e=>setEditValues({...editValues, mobile: sanitizeDigits(e.target.value, 10)})}
                      className="p-2 border rounded w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm">Email</label>
                    <input value={editValues.email} onChange={e=>setEditValues({...editValues, email:e.target.value})} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm">Guardian Mobile</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="\d{10}"
                      maxLength={10}
                      value={editValues.guardian_mobile}
                      onChange={e=>setEditValues({...editValues, guardian_mobile: sanitizeDigits(e.target.value, 10)})}
                      className="p-2 border rounded w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm">Father Occupation</label>
                    <input value={editValues.father_occupation} onChange={e=>setEditValues({...editValues, father_occupation:e.target.value})} className="p-2 border rounded w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm">Address</label>
                    <textarea value={editValues.address} onChange={e=>setEditValues({...editValues, address:e.target.value})} className="p-2 border rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm">Annual Income</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editValues.annual_income}
                      onChange={e=>setEditValues({...editValues, annual_income: sanitizeDigits(e.target.value, 12)})}
                      className="p-2 border rounded w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4 space-x-2">
                  <button onClick={()=>{setFetchedStudent(null); setSection('fetch');}} className="px-3 py-2 bg-gray-100 rounded">Back</button>
                  {hasEdits() ? (
                    <button onClick={handleSaveEdits} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded">{saving? 'Saving...':'Save Changes'}</button>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 flex items-center">No changes to save</div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Note: Profile Picture Must and should uploaded by Students Itself.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
