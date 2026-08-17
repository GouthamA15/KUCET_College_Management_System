"use client";

import { useEffect, useState, Suspense } from 'react';
import { useStaff } from '@/context/StaffContext';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import StudentInfoCard from '@/components/staff/scholarship/StudentInfoCard';
import StudentAcademicSummaryCard from '@/components/staff/scholarship/StudentAcademicSummaryCard';
import YearRecordsList from '@/components/staff/scholarship/YearRecordsList';
import AddEditRecordInstitutionalModal from '@/components/staff/scholarship/AddEditRecordInstitutionalModal';
import ScholarshipSearchCard from '@/components/staff/scholarship/ScholarshipSearchCard';
import { useScholarshipDashboard } from '@/context/ScholarshipDashboardContext';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber';
import { formatDate, toMySQLDate } from '@/lib/date';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Info } from 'lucide-react';

function StudentRecordsContent() {
  const { clerkData: clerk, loading: isClerkLoading } = useStaff();
  const { state, setField, resetStudent, setState } = useScholarshipDashboard();
  const {
    roll,
    searchMode,
    applicationNoInput,
    nameInput,
    nameResults,
    rollError,
    student,
    feeSummary,
    yearList,
    summariesByYear,
    expandedByYear,
  } = state;

  const setRoll = (v) => setField('roll', v);
  const setSearchMode = (v) => setField('searchMode', v);
  const setApplicationNoInput = (v) => setField('applicationNoInput', v);
  const setNameInput = (v) => setField('nameInput', v);
  const setNameResults = (v) => setField('nameResults', v);
  const setRollError = (v) => setField('rollError', v);
  const setExpandedByYear = (updater) => {
    setState((prev) => ({
      ...prev,
      expandedByYear:
        typeof updater === 'function'
          ? updater(prev.expandedByYear || { /* empty */ })
          : updater,
    }));
  };

  const MAX_ROLL = 10;
  const [loading, setLoading] = useState(false);
  const [_scholarshipProceedings, setScholarshipProceedings] = useState([]);
  const [_studentPayments, setStudentPayments] = useState([]);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  
  // Instructions panel state
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalYear, setModalYear] = useState('');
  const [schAppNo, setSchAppNo] = useState('');
  const [schProceedingNo, setSchProceedingNo] = useState('');
  const [schAmount, setSchAmount] = useState('');
  const [schSanctionDate, setSchSanctionDate] = useState('');
  const [releasedAmount, setReleasedAmount] = useState('');
  const [releasedDate, setReleasedDate] = useState('');
  const [schStatus, setSchStatus] = useState('SANCTIONED');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [bankName, setBankName] = useState('');
  const [saving, setSaving] = useState(false);
  const [appEditing, setAppEditing] = useState(false);
  const [thumbUpdateAvailable, setThumbUpdateAvailable] = useState(false);
  const [thumbStatus, setThumbStatus] = useState('Pending');
  const [hardcopySubmitted, setHardcopySubmitted] = useState(false);
  const [selectedProceeding, setSelectedProceeding] = useState(null);

  const setFormState = (k, v) => {
    const setters = {
      schAppNo: setSchAppNo,
      schProceedingNo: setSchProceedingNo,
      schAmount: setSchAmount,
      schSanctionDate: setSchSanctionDate,
      releasedAmount: setReleasedAmount,
      releasedDate: setReleasedDate,
      payAmount: setPayAmount,
      payRef: setPayRef,
      payDate: setPayDate,
      payMode: setPayMode,
      bankName: setBankName,
      appEditing: setAppEditing,
      thumbUpdateAvailable: setThumbUpdateAvailable,
      thumbStatus: setThumbStatus,
      hardcopySubmitted: setHardcopySubmitted,
      schStatus: setSchStatus,
    };
    const fn = setters[k] || (() => { /* empty */ });
    fn(v);
  };

  const handleClearDashboard = () => {
    setRoll('');
    setApplicationNoInput('');
    setNameInput('');
    setNameResults([]);
    setRollError('');
    setSearchMode('roll');
    localResetStudent();
    setModalOpen(false);
    setModalYear('');
    setSchAppNo('');
    setSchProceedingNo('');
    setSchAmount('');
    setSchSanctionDate('');
    setReleasedAmount('');
    setReleasedDate('');
    setSchStatus('SANCTIONED');
    setPayAmount('');
    setPayRef('');
    setPayDate('');
    setPayMode('UPI');
    setBankName('');
    setSaving(false);
    setAppEditing(false);
    setThumbUpdateAvailable(false);
    setThumbStatus('Pending');
    setHardcopySubmitted(false);
    setSelectedProceeding(null);
  };

  useEffect(() => {
    if (!isClerkLoading && clerk && clerk.role !== 'scholarship') {
      toast.error('Access Denied');
    }
  }, [clerk, isClerkLoading]);

  const toDmy = (val) => formatDate(val) || '-';

  const localResetStudent = () => {
    resetStudent();
    setScholarshipProceedings([]);
    setStudentPayments([]);
  };

  const handleSelectStudentFromName = async (rollNo) => {
    if (!rollNo) return;
    setRoll(String(rollNo));
    setSearchMode('roll');
    setNameResults([]);
    try {
      await fetchStudent(null, 'roll', rollNo);
    } catch { /* empty */ }
  };

  const fetchStudent = async (e, overrideMode = null, overrideRoll = null) => {
    if (e && e.preventDefault) e.preventDefault();
    
    const currentMode = overrideMode || searchMode;
    const currentRoll = overrideRoll || roll;

    if (currentMode === 'name') {
      const term = String(nameInput || '').trim();
      if (term.length < 2) {
        toast.error('Enter at least 2 characters for name search');
        return;
      }
      setLoading(true);
      setNameResults([]);
      const id = toast.loading('Searching students by name...');
      try {
        const url = `/api/staff/scholarship/search-by-name?name=${encodeURIComponent(term)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to search students');
        const list = Array.isArray(data?.students) ? data.students : [];
        if (list.length === 0) {
          toast.error('No students found for given name', { id });
        } else {
          toast.success(`Found ${list.length} student(s)`, { id });
        }
        setNameResults(list);
      } catch (err) {
        toast.error(err.message || 'Failed to search students', { id });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (currentMode === 'roll') {
      if (!currentRoll) return;
      if (String(currentRoll).length !== MAX_ROLL) {
        toast.error(`Roll Number must be ${MAX_ROLL} characters long`);
        return;
      }
      try {
        const { isValid } = validateRollNo(String(currentRoll));
        if (!isValid) {
          toast.error('Invalid Roll Number format');
          return;
        }
      } catch (_err) {
        toast.error('Invalid Roll Number format');
        return;
      }
    } else {
      if (!applicationNoInput) return;
    }

    setLoading(true);
    localResetStudent();
    const id = toast.loading('Fetching student...');
    try {
      let res, data, payload;
      if (currentMode === 'roll') {
        res = await fetch(`/api/staff/scholarship/summary/${encodeURIComponent(currentRoll)}`);
        data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'Student not found');
        payload = (data && data.data) ? data.data : data;
        setField('student', payload.student || null);
        setField('feeSummary', payload.fee_summary || null);
        setScholarshipProceedings(Array.isArray(payload.scholarship_proceedings) ? payload.scholarship_proceedings : []);
        setStudentPayments(Array.isArray(payload.student_payments) ? payload.student_payments : []);

        const list = deriveYearsFromAdmission(String(payload?.student?.admission_year || ''));
        setField('yearList', list);
        const urls = list.map(y => `/api/staff/scholarship/summary/${encodeURIComponent(currentRoll)}?year=${encodeURIComponent(y)}`);
        const results = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));
        const byYear = { /* empty */ };
        results.forEach((res, idx) => {
          const y = list[idx];
          const raw = (res.status === 'fulfilled' ? res.value : null) || null;
          byYear[y] = raw && raw.data ? raw.data : raw;
        });
        setField('summariesByYear', byYear);
        setField('expandedByYear', list.reduce((acc, y) => { acc[y] = false; return acc; }, { /* empty */ }));
      } else {
        res = await fetch(`/api/staff/scholarship/application/${encodeURIComponent(applicationNoInput)}`);
        data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'Student not found');
        payload = (data && data.data) ? data.data : data;
        setField('student', payload.student || null);
        if (payload.year_records && typeof payload.year_records === 'object') {
          const years = Object.keys(payload.year_records || { /* empty */ });
          setField('yearList', years);
          setField('summariesByYear', payload.year_records);
          setField('expandedByYear', years.reduce((acc, y) => { acc[y] = false; return acc; }, { /* empty */ }));
        } else {
          const list = deriveYearsFromAdmission(String(payload?.student?.admission_year || ''));
          setField('yearList', list);
          setField('expandedByYear', list.reduce((acc, y) => { acc[y] = false; return acc; }, { /* empty */ }));
        }
      }
      toast.success('Student loaded', { id });
    } catch (err) {
      toast.error(err.message || 'Failed to fetch student', { id });
    } finally {
      setLoading(false);
    }
  };

  function deriveYearsFromAdmission(period) {
    const m = String(period).match(/^(\d{4})-(\d{4})$/);
    if (!m) return [];
    const start = parseInt(m[1], 10);
    return [0,1,2,3].map(offset => {
      const s = start + offset;
      const e = s + 1;
      return `${s}-${String(e).slice(-2)}`;
    });
  }

  function computeRecordState(summary, globalFeeSummary) {
    if (!summary) return 'NO_RECORD';
    const hasScholar = Array.isArray(summary.scholarship_proceedings) && summary.scholarship_proceedings.length > 0;
    const hasPayments = Array.isArray(summary.student_payments) && summary.student_payments.length > 0;
    const hasApplication = !!(summary.application_no && String(summary.application_no).trim() !== '');
    if (!hasScholar && !hasPayments && !hasApplication) return 'NO_RECORD';
    if (summary.record_state && ['NO_RECORD', 'PENDING', 'COMPLETED'].includes(summary.record_state)) return summary.record_state;
    const fs = summary.fee_summary || { /* empty */ };
    let pending = fs.pending_fee;
    if (pending == null) {
      const total = fs.total_fee ?? globalFeeSummary?.total_fee ?? null;
      if (total == null) return 'PENDING';
      pending = total;
    }
    const pendingNum = Number(pending);
    if (!isNaN(pendingNum) && pendingNum === 0) return 'COMPLETED';
    return 'PENDING';
  }

  function openAddModal(year) {
    setModalYear(year);
    setModalOpen(true);
    try {
      const existingApp = (summariesByYear[year]?.application_no) || '';
      setSchAppNo(existingApp);
      setAppEditing(false);
    } catch { setSchAppNo(''); setAppEditing(false); }
    setSchProceedingNo('');
    setSchAmount('');
    setSchSanctionDate('');
    setReleasedAmount('');
    setReleasedDate('');
    setSchStatus('SANCTIONED');
    setPayAmount('');
    setPayRef('');
    setPayDate('');
    setPayMode('UPI');
    setBankName('');
    setSelectedProceeding(null);
    try {
      const summaryData = summariesByYear[year] || { /* empty */ };
      const thumbAvailable = summaryData?.thumb_update_available === 1 || summaryData?.thumb_update_available === true;
      const thumbStatusRaw = summaryData?.thumb_status ?? 'PENDING';
      const ts = String(thumbStatusRaw).toLowerCase();
      const completeValues = ['complete', '1', 'true', 'success', 'done'];
      const thumbStatusNorm = completeValues.includes(ts) ? 'Complete' : 'Pending';
      setFormState('thumbUpdateAvailable', thumbAvailable);
      setFormState('thumbStatus', thumbStatusNorm);
    } catch {
      setFormState('thumbUpdateAvailable', false);
      setFormState('thumbStatus', 'Pending');
    }
    try {
      const summaryData = summariesByYear[year] || { /* empty */ };
      const hardcopy = summaryData?.hardcopy_submitted === 1 || summaryData?.hardcopy_submitted === true;
      setFormState('hardcopySubmitted', hardcopy);
    } catch {
      setFormState('hardcopySubmitted', false);
    }
  }

  async function refetchYearSummary(rollNo, year) {
    try {
      const res = await fetch(`/api/staff/scholarship/summary/${encodeURIComponent(rollNo)}?year=${encodeURIComponent(year)}`);
      const data = res.ok ? await res.json() : null;
      const payload = data && data.data ? data.data : data;
      setField('summariesByYear', {
        ...summariesByYear,
        [year]: payload,
      });
    } catch { /* empty */ }
  }

  async function handleProceedingSave() {
    if (!student || !modalYear) return;
    setSaving(true);
    try {
      if (!schAppNo) throw new Error('Application Number is required');
      const hasAmount = Number(schAmount) > 0;
      if (hasAmount && !String(schProceedingNo || '').trim()) {
        throw new Error('Proceeding Number is required to enter sanctioned amount');
      }
      if (hasAmount && !schSanctionDate) {
        throw new Error('Sanction Date is required for entered amount');
      }
      const hasRelAmount = Number(releasedAmount) > 0;
      if (hasRelAmount && !releasedDate) {
        throw new Error('Released Date is required for entered amount');
      }

      const amt = hasAmount ? Number(schAmount) : null;
      const sanctionBody = {
        roll_no: student.roll_no,
        academic_year: modalYear,
        application_no: schAppNo || null,
        proceeding_no: schProceedingNo || null,
        sanctioned_amount: amt,
        sanction_date: schSanctionDate || null,
        released_amount: hasRelAmount ? Number(releasedAmount) : null,
        released_date: releasedDate || null,
        status: schStatus || 'SANCTIONED',
        thumb_update_available: !!thumbUpdateAvailable,
        thumb_status: String(thumbStatus || 'PENDING').toUpperCase() === 'COMPLETE' ? 'COMPLETED' : String(thumbStatus || 'PENDING').toUpperCase(),
        hardcopy_submitted: !!hardcopySubmitted,
      };

      const res = await fetch('/api/staff/scholarship/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanctionBody)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to save sanction');
      
      toast.success('Proceeding recorded');
      setSchProceedingNo('');
      setSchAmount('');
      setSchSanctionDate('');
      setReleasedAmount('');
      setReleasedDate('');
      setSelectedProceeding(null);
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to save proceeding');
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentSave() {
    if (!student || !modalYear) return;
    setSaving(true);
    try {
      const pAmt = Number(payAmount);
      if (!(pAmt > 0)) throw new Error('Student Paid Amount must be > 0');
      if (!payRef) throw new Error('Transaction Ref is required');
      if (!payDate) throw new Error('Transaction Date is required');

      const paymentBody = {
        roll_no: student.roll_no,
        academic_year: modalYear,
        transaction_ref: payRef,
        amount: pAmt,
        transaction_date: payDate,
        payment_mode: payMode || 'UPI',
        bank_name: bankName || null,
      };

      const res = await fetch('/api/staff/scholarship/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save payment');

      toast.success('Payment recorded');
      setPayAmount('');
      setPayRef('');
      setPayDate('');
      setPayMode('UPI');
      setBankName('');
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalUpdate() {
    if (!student || !modalYear) return;
    setSaving(true);
    try {
      const updateBody = {
        roll_no: student.roll_no,
        academic_year: modalYear,
        application_no: schAppNo || null,
        hardcopy_submitted: !!hardcopySubmitted,
        thumb_update_available: !!thumbUpdateAvailable,
        thumb_status: String(thumbStatus || 'PENDING').toUpperCase() === 'COMPLETE' ? 'COMPLETED' : String(thumbStatus || 'PENDING').toUpperCase()
      };

      const res = await fetch('/api/staff/scholarship/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to update registry');

      toast.success('Registry record updated');
      setModalOpen(false);
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  }

  async function deleteScholarship(id) {
    if (!id) return;
    if (!confirm('Delete this scholarship proceeding?')) return;
    try {
      const res = await fetch(`/api/staff/scholarship/sanctions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ /* empty */ }));
        throw new Error(e.error || 'Failed to delete proceeding');
      }
      toast.success('Proceeding deleted');
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to delete proceeding');
    }
  }

  async function deletePayment(id) {
    if (!id) return;
    if (!confirm('Delete this payment?')) return;
    try {
      const res = await fetch(`/api/staff/scholarship/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ /* empty */ }));
        throw new Error(e.error || 'Failed to delete payment');
      }
      toast.success('Payment deleted');
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to delete payment');
    }
  }

  if (isClerkLoading && !clerk) {
    return <LoadingSpinner label="Loading Workspace..." />;
  }
  if (!clerk) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
      {/* Header Section */}
      <div className="flex flex-col mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Student Records</h1>
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => setInstructionsExpanded(true)}
            onMouseLeave={() => setInstructionsExpanded(false)}
          >
            <button 
              className="text-[#0b3578] hover:bg-slate-100 p-1.5 rounded-full transition-colors focus:outline-none cursor-help"
              title="View Instructions"
              type="button"
            >
              <Info size={20} />
            </button>
            
            {instructionsExpanded && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-5 z-50 text-left animate-slideDown">
                <h4 className="text-base font-semibold text-[#0b2447] mb-2">Workspace Guidelines</h4>
                <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-2.5">
                  <div className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Search by Roll Number for fastest results.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Application Number searches current academic year records.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Student Name searches may return multiple students.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Scholarship processing requires current academic year verification.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">Search and manage scholarship registry data</p>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-[#0b3578] text-white shadow-sm">
            Search Student
          </button>
          <button disabled className="px-3 py-2 rounded-md text-sm transition-colors bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed">
            Import Records
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12">

          <ScholarshipSearchCard
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            roll={roll}
            setRoll={setRoll}
            applicationNoInput={applicationNoInput}
            setApplicationNoInput={setApplicationNoInput}
            nameInput={nameInput}
            setNameInput={setNameInput}
            rollError={rollError}
            setRollError={setRollError}
            MAX_ROLL={MAX_ROLL}
            loading={loading}
            onSubmit={fetchStudent}
            nameResults={nameResults}
            onSelectStudentFromName={handleSelectStudentFromName}
            onClear={handleClearDashboard}
          />
        </div>
      </div>
    </div>

      {/* Search Results Area */}
      {student && (
        <section className="space-y-6 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-1">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Student Workspace</h2>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active student loaded • {student.roll_no}</p>
            </div>
            <button
              type="button"
              onClick={handleClearDashboard}
              className="px-4 py-2 bg-white text-slate-700 text-[11px] font-bold uppercase tracking-widest rounded-md border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578]"
            >
              Clear Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <StudentInfoCard
                student={student}
                onImageClick={(src) => {
                  setImagePreviewSrc(src);
                  setImagePreviewOpen(true);
                }}
              />
              <StudentAcademicSummaryCard student={student} />
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Year Timeline Records</h3>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Expand for fee & proceedings</span>
              </div>
              <YearRecordsList
                yearList={yearList}
                summariesByYear={summariesByYear}
                expandedByYear={expandedByYear}
                onToggleExpand={(yy) =>
                  setExpandedByYear((prev) => ({ ...prev, [yy]: !prev[yy] }))
                }
                onOpenModal={(yy) => openAddModal(yy)}
                computeRecordState={computeRecordState}
                feeSummary={feeSummary}
                student={student}
                toDmy={toDmy}
              />
            </div>
          </div>

          <AddEditRecordInstitutionalModal
            open={modalOpen}
            year={modalYear}
            student={student}
            summary={summariesByYear[modalYear] || null}
            formState={{
              schAppNo,
              schProceedingNo,
              schAmount,
              schSanctionDate,
              releasedAmount,
              releasedDate,
              payAmount,
              payRef,
              payDate,
              payMode,
              bankName,
              appEditing,
              thumbUpdateAvailable,
              thumbStatus,
              hardcopySubmitted,
              selectedProceeding,
            }}
            setFormState={(k, v) => setFormState(k, v)}
            saving={saving}
            onProceedingSave={handleProceedingSave}
            onPaymentSave={handlePaymentSave}
            onFinalUpdate={handleFinalUpdate}
            onClose={() => setModalOpen(false)}
            onDeletePayment={deletePayment}
            onDeleteScholarship={deleteScholarship}
            onSelectProceeding={(p) => {
               setSelectedProceeding(p);
               setSchProceedingNo(p.proceeding_no || '');
               setSchAmount(p.amount || '');
               setSchSanctionDate(toMySQLDate(p.date) || '');
               setReleasedAmount(p.released_amount || '');
               setReleasedDate(toMySQLDate(p.released_date) || '');
               setSchStatus(p.status || 'SANCTIONED');
            }}
            onCancelEdit={() => {
               setSelectedProceeding(null);
               setSchProceedingNo('');
               setSchAmount('');
               setSchSanctionDate('');
               setReleasedAmount('');
               setReleasedDate('');
               setSchStatus('SANCTIONED');
            }}
            toDmy={toDmy}
          />
        </section>
      )}
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}

export default function StudentRecordsPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading Student Records..." />}>
      <StudentRecordsContent />
    </Suspense>
  );
}
