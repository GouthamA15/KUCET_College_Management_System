"use client";
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';
import { getEntranceExamQualified, getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';

export default function FetchStudent({ setActiveAction, setFetchedStudent, setPersonalFull, setAcademicsList, setFeesList, setFeeDetails, setEditValues, setOriginalEditValues, setOriginalPersonalFull, setOriginalAcademicsList }) {
  const [fetchRoll, setFetchRoll] = useState('');
  const [fetchAdmission, setFetchAdmission] = useState('');
  const [fetchName, setFetchName] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedList, setFetchedList] = useState([]);

  const canFetch = () => {
    return fetchRoll.trim() || fetchAdmission.trim() || fetchName.trim();
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
      
      if (!currentQualifyingExam) {
        currentQualifyingExam = getEntranceExamQualified(student.roll_no) || 'EAMCET';
        isQualifyingExamDerived = true;
      }
      
      if (initialAcademics.length === 0) {
        initialAcademics.push({ qualifying_exam: currentQualifyingExam, ranks: currentRanks });
      } else {
        initialAcademics[0] = { ...initialAcademics[0], qualifying_exam: currentQualifyingExam, ranks: currentRanks };
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

  return (
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
  );
}
