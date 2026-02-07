"use client";
import React, { useState, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { formatDate, parseDate } from '@/lib/date';
import Image from 'next/image';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { getBranchFromRoll, getAdmissionTypeFromRoll, getEntranceExamQualified } from '@/lib/rollNumber';

const DatePickerInput = forwardRef(({ value, onClick, ...props }, ref) => (
    <input
      onClick={onClick}
      ref={ref}
      value={value ?? ''}
      {...props}
    />
  ));
DatePickerInput.displayName = 'DatePickerInput';

export default function ViewEditStudent({ fetchedStudent, setActiveAction }) {
  const MAX_MOBILE_LEN = 10;
  const MAX_ANNUAL_INCOME = 99999999; // match AddNewStudent
  const [editValues, setEditValues] = useState({});
  const [personalFull, setPersonalFull] = useState({});
  const [academicsList, setAcademicsList] = useState([]);
  const [feesList, setFeesList] = useState([]);
  const [feeDetails, setFeeDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [originalEditValues, setOriginalEditValues] = useState(null);
  const [originalPersonalFull, setOriginalPersonalFull] = useState(null);
  const [originalAcademicsList, setOriginalAcademicsList] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [isQualifyingExamAutofilled, setIsQualifyingExamAutofilled] = useState(false);
  const [annualIncomeDisplay, setAnnualIncomeDisplay] = useState('');

  useEffect(() => {
    if (fetchedStudent) {
      const pd = fetchedStudent.personal_details || {};
      const initialEdit = {
        admission_no: fetchedStudent.admission_no || null,
        roll_no: fetchedStudent.roll_no || null,
        name: fetchedStudent.name || null,
        date_of_birth: formatDate(fetchedStudent.date_of_birth) || null,
        gender: fetchedStudent.gender || 'Male',
        admission_type: getAdmissionTypeFromRoll(fetchedStudent.roll_no) || null,
        course: getBranchFromRoll(fetchedStudent.roll_no) || null,
        mobile: sanitizeDigits(fetchedStudent.mobile || '' , 10) || null,
        email: fetchedStudent.email || null,
        address: pd.address || fetchedStudent.address || null,
        father_occupation: pd.father_occupation || null,
        annual_income: sanitizeDigits(pd.annual_income || '', 12) || null
      };
      setEditValues(initialEdit);
      setOriginalEditValues(JSON.parse(JSON.stringify(initialEdit)));

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
        aadhaar_no: pd.aadhaar_no || null,
        address: pd.address || fetchedStudent.address || null,
        seat_allotted_category: pd.seat_allotted_category || null,
        identification_marks: pd.identification_marks || null
      };
      setPersonalFull(initialPersonal);
      setAnnualIncomeDisplay(formatIndianNumber(initialPersonal.annual_income || ''));
      setOriginalPersonalFull(JSON.parse(JSON.stringify(initialPersonal)));

      const initialAcademics = Array.isArray(fetchedStudent.academics) ? fetchedStudent.academics : [];
      let currentQualifyingExam = initialAcademics.length > 0 ? initialAcademics[0].qualifying_exam : '';
      let currentRanks = initialAcademics.length > 0 ? initialAcademics[0].ranks : '';
      let isQualifyingExamDerived = false;
      if (!currentQualifyingExam) {
        currentQualifyingExam = getEntranceExamQualified(fetchedStudent.roll_no) || 'EAMCET';
        isQualifyingExamDerived = true;
      }
      if (initialAcademics.length === 0) {
        initialAcademics.push({ qualifying_exam: currentQualifyingExam, ranks: currentRanks });
      } else {
        initialAcademics[0] = { ...initialAcademics[0], qualifying_exam: currentQualifyingExam, ranks: currentRanks };
      }
      setAcademicsList(initialAcademics);
      setOriginalAcademicsList(JSON.parse(JSON.stringify(initialAcademics)));
      setIsQualifyingExamAutofilled(isQualifyingExamDerived);

      setFeesList(Array.isArray(fetchedStudent.fees) ? fetchedStudent.fees : []);
      setFeeDetails(fetchedStudent.student_fee_details || null);
    }
  }, [fetchedStudent]);

  const sanitizeDigits = (input, maxLen = 10) => {
    if (input == null) return '';
    const s = String(input).replace(/\D/g, '');
    return s.slice(0, maxLen);
  };
  
  const formatAadhaar = (val) => {
    if (val == null) return '';
    const digits = String(val).replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatIndianNumber = (digits) => {
    if (!digits) return '';
    const s = String(digits).replace(/\D/g, '');
    if (s.length <= 3) return s;
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
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
        date_of_birth: editValues.date_of_birth,
        gender: editValues.gender,
        mobile: editValues.mobile,
        email: editValues.email,
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
      // After successful save, you might want to refetch the data or update the state
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
  const categories = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'];

  return (
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
                <input type="email" placeholder="Email" value={editValues.email || ''} onChange={e=>setEditValues({...editValues, email:e.target.value})} className="p-2 border rounded" />
                <div className="col-span-1 md:col-span-3 text-sm text-gray-500">Profile Picture is view-only here. Inform Students to Upload their Profile Picture Through Their Student Login.</div>
              </div>
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
                <input
                  placeholder="Annual Income"
                  value={annualIncomeDisplay}
                  onChange={(e) => {
                    const raw = String(e.target.value || '').replace(/\D/g, '').slice(0, String(MAX_ANNUAL_INCOME).length);
                    const num = raw ? Number(raw) : '';
                    if (num !== '' && num > MAX_ANNUAL_INCOME) {
                      setPersonalFull(prev => ({ ...prev, annual_income: String(MAX_ANNUAL_INCOME) }));
                      setAnnualIncomeDisplay(formatIndianNumber(String(MAX_ANNUAL_INCOME)));
                    } else {
                      setPersonalFull(prev => ({ ...prev, annual_income: raw }));
                      setAnnualIncomeDisplay(formatIndianNumber(raw));
                    }
                  }}
                  type="text"
                  className="p-2 border rounded"
                  inputMode="numeric"
                  onPaste={(e) => { const pasted=(e.clipboardData||window.clipboardData).getData('text'); const digits=pasted.replace(/\D/g,'').slice(0, String(MAX_ANNUAL_INCOME).length); setPersonalFull(prev=>({...prev, annual_income: digits})); setAnnualIncomeDisplay(formatIndianNumber(digits)); e.preventDefault(); }}
                />
                <input placeholder="Aadhaar Number" value={personalFull.aadhaar_no || ''} onChange={e=>setPersonalFull({...personalFull, aadhaar_no: formatAadhaar(e.target.value)})} className="p-2 border rounded" />
                <textarea placeholder="Address" value={personalFull.address || ''} onChange={e=>setPersonalFull({...personalFull, address:e.target.value})} className="p-2 border rounded md:col-span-3 h-24 resize-none" />
                <input placeholder="Seat Allotted Category" value={personalFull.seat_allotted_category || ''} onChange={e=>setPersonalFull({...personalFull, seat_allotted_category:e.target.value})} className="p-2 border rounded" />
                <textarea placeholder="Identification Marks" value={personalFull.identification_marks || ''} onChange={e=>setPersonalFull({...personalFull, identification_marks:e.target.value})} className="p-2 border rounded md:col-span-3 h-20 resize-none" />
              </div>
            </div>
          </div>
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
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}