"use client";
import React, { useState } from 'react';
import _toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';
import { getEntranceExamQualified, getBranchFromRoll, getAdmissionTypeFromRoll, validateRollNo } from '@/lib/rollNumber';

export default function FetchStudent({ setActiveAction, setFetchedStudent, setPersonalFull, setAcademicsList, setFeesList, setFeeDetails, setEditValues, setOriginalEditValues, setOriginalPersonalFull, setOriginalAcademicsList }) {
  const [fetchRoll, setFetchRoll] = useState('');
  const [fetchRollNoError, setFetchRollNoError] = useState('');
  const [fetchAdmission, setFetchAdmission] = useState('');
  const [fetchName, setFetchName] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedList, setFetchedList] = useState([]);

  const canFetch = () => {
    return fetchRoll.trim() || fetchAdmission.trim() || fetchName.trim();
  };

  const MAX_ROLL = 10;

  const sanitizeRoll = (input) => {
    if (input == null) return '';
    // Allow only uppercase alphanumeric characters (A-Z, 0-9)
    const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.slice(0, MAX_ROLL);
  };

  const sanitizeDigits = (input, maxLen = 10) => {
    if (input == null) return '';
    const s = String(input).replace(/\D/g, '');
    return s.slice(0, maxLen);
  };

  const loadFullProfileByRoll = async (roll) => {
    setFetchError('');
    setFetchedStudent(null);
    try{
      const res = await fetch(`/api/clerk/students/${roll}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Student not found');
      const student = {
        ...data.student,
        academics: data.academics,
        fees: data.fees,
        student_fee_details: data.student_fee_details
      };
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
        guardian_mobile: pd.guardian_mobile || '',
        aadhaar_no: pd.aadhaar_no || '',
        curr_house_no: pd.curr_house_no || '',
        curr_street: pd.curr_street || '',
        curr_apartment: pd.curr_apartment || '',
        curr_city: pd.curr_city || '',
        curr_state: pd.curr_state || '',
        curr_pincode: pd.curr_pincode || '',
        curr_country: pd.curr_country || '',
        perm_house_no: pd.perm_house_no || '',
        perm_street: pd.perm_street || '',
        perm_apartment: pd.perm_apartment || '',
        perm_city: pd.perm_city || '',
        perm_state: pd.perm_state || '',
        perm_pincode: pd.perm_pincode || '',
        perm_country: pd.perm_country || '',
        is_current_same_as_permanent: !!pd.is_current_same_as_permanent,
        seat_allotted_category: pd.seat_allotted_category || '',
        identification_marks: pd.identification_marks || ''
      });

      const initialAcademics = Array.isArray(data.academics) ? data.academics : [];
      let currentQualifyingExam = initialAcademics.length > 0 ? initialAcademics[0].qualifying_exam : '';
      let currentRanks = initialAcademics.length > 0 ? initialAcademics[0].ranks : '';
      let currentSscMarks = initialAcademics.length > 0 ? initialAcademics[0].ssc_marks : '';
      let currentInterMarks = initialAcademics.length > 0 ? initialAcademics[0].inter_marks : '';

      if (!currentQualifyingExam) {
        currentQualifyingExam = getEntranceExamQualified(student.roll_no) || 'TG EAPCET';
      }
      
      if (initialAcademics.length === 0) {
        initialAcademics.push({ qualifying_exam: currentQualifyingExam, ranks: currentRanks, ssc_marks: currentSscMarks, inter_marks: currentInterMarks });
      } else {
        initialAcademics[0] = { ...initialAcademics[0], qualifying_exam: currentQualifyingExam, ranks: currentRanks, ssc_marks: currentSscMarks, inter_marks: currentInterMarks };
      }
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
        guardian_mobile: pd.guardian_mobile || null,
        aadhaar_no: pd.aadhaar_no || null,
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
      if (fetchRoll.trim()) {
        // Validate roll client-side similar to LoginPanel
        const rn = fetchRoll.trim();
        const { isValid } = validateRollNo(rn);
        if (!isValid) {
          setFetchError('Invalid Roll Number format.');
          setFetchLoading(false);
          return;
        }
        await loadFullProfileByRoll(rn);
        return;
      }
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

  return (
    <div className="space-y-4 animate-fadeIn text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Roll Number</label>
          <input
            placeholder="e.g. 21B81A0501"
            value={fetchRoll}
            onChange={(e) => {
              const v = sanitizeRoll(e.target.value);
              setFetchRoll(v);
              if (v.length > 0 && v.length === MAX_ROLL) {
                const { isValid } = validateRollNo(v);
                if (!isValid) setFetchRollNoError('Invalid format.');
                else setFetchRollNoError('');
              } else if (v.length > 0 && v.length !== MAX_ROLL) {
                setFetchRollNoError(`Must be ${MAX_ROLL} chars.`);
              } else setFetchRollNoError('');
            }}  
            className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578] uppercase"
            maxLength={MAX_ROLL}
          />
          {fetchRollNoError && <div className="text-red-600 text-xs mt-1">{fetchRollNoError}</div>}
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Admission Number</label>
          <input 
            placeholder="e.g. ADM2023001" 
            value={fetchAdmission} 
            onChange={e=>setFetchAdmission(e.target.value)} 
            className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578] uppercase" 
          />
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Student Name</label>
          <input 
            placeholder="Enter full or partial name" 
            value={fetchName} 
            onChange={e=>setFetchName(e.target.value)} 
            className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578]" 
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button 
          onClick={()=>{setFetchRoll(''); setFetchAdmission(''); setFetchName(''); setFetchError(''); setFetchRollNoError('');}} 
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleFetch}
          disabled={!canFetch() || fetchLoading || !!fetchRollNoError}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            (!canFetch() || fetchLoading || !!fetchRollNoError) 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
              : 'bg-[#0b3578] text-white hover:bg-[#082654] border border-[#0b3578] shadow-sm'
          }`}
        >
          {fetchLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span>Search Records</span>
            </>
          )}
        </button>
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 flex items-center gap-2 mt-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {fetchError}
        </div>
      )}

      {fetchedList && fetchedList.length > 1 && (
        <div className="mt-6 bg-white border border-gray-300 rounded-md overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="bg-[#0b3578] text-white px-2 py-0.5 rounded-full text-xs">{fetchedList.length}</span>
              Multiple Results Found
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {fetchedList.map(s => (
              <div key={s.roll_no} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{s.roll_no}</span>
                      <span>Adm: {s.admission_no || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={()=>loadFullProfileByRoll(s.roll_no)} 
                  className="px-3 py-1.5 bg-white border border-gray-300 text-[#0b3578] hover:bg-gray-50 rounded-md text-xs font-medium transition-colors cursor-pointer"
                >
                  Open Profile
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
