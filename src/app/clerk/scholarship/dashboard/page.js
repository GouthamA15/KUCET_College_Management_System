"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useClerk } from '@/context/ClerkContext';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import StudentInfoCard from '@/components/clerk/scholarship/StudentInfoCard';
import StudentAcademicSummaryCard from '@/components/clerk/scholarship/StudentAcademicSummaryCard';
import YearRecordsList from '@/components/clerk/scholarship/YearRecordsList';
import AddEditRecordModal from '@/components/clerk/scholarship/AddEditRecordModal';
import AddEditRecordInstitutionalModal from '@/components/clerk/scholarship/AddEditRecordInstitutionalModal';
import ScholarshipMetricsCards from '@/components/clerk/scholarship/ScholarshipMetricsCards';
import ScholarshipSearchCard from '@/components/clerk/scholarship/ScholarshipSearchCard';
import ScholarshipWindowCard from '@/components/clerk/scholarship/ScholarshipWindowCard';
import { useScholarshipDashboard } from '@/context/ScholarshipDashboardContext';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber';
import { formatDate, toMySQLDate } from '@/lib/date';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { smoothScrollToId } from '@/lib/scroll-utils';
import { logoutScholarshipDashboard } from '@/lib/logout';


function ScholarshipDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clerkData: clerk, loading: isClerkLoading } = useClerk();
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
          ? updater(prev.expandedByYear || {})
          : updater,
    }));
  };
  const MAX_ROLL = 10;
  const [loading, setLoading] = useState(false); // For fetching student data
  const [scholarshipProceedings, setScholarshipProceedings] = useState([]);
  const [studentPayments, setStudentPayments] = useState([]);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [view, setView] = useState('dashboard');

  const firstName = clerk?.name?.split(' ')[0] || 'Clerk';
  const employeeId = clerk?.employee_id || (clerk?.role ? String(clerk.role).toUpperCase() : 'SCHOLARSHIP');
  const roleLabel = 'Scholarship Clerk';

  const openProfile = () => {
    try {
      router.push('/clerk/scholarship/profile');
    } catch {
      // ignore
    }
  };

  const backToDashboard = () => {
    setView('dashboard');
    try {
      router.push('/clerk/scholarship/dashboard');
    } catch {
      // ignore
    }
  };

  // URL Parameter Handling: switch view and auto-scroll
  useEffect(() => {
    const v = searchParams.get('view');
    const scroll = searchParams.get('scroll');

    let viewTimer;
    let scrollTimer;

    if (v === 'requests' || v === 'certificates' || v === 'verification') {
      viewTimer = setTimeout(() => {
        setView('certificates');
      }, 0);

      if (scroll === '1') {
        scrollTimer = setTimeout(() => {
          smoothScrollToId('certificate-section', { behavior: 'smooth', block: 'start' });
        }, 800);
      }
    }

    return () => {
      if (viewTimer) clearTimeout(viewTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [searchParams]);

  const [metricsRefreshToken, setMetricsRefreshToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalYear, setModalYear] = useState('');
  // Modal form state
  const [schAppNo, setSchAppNo] = useState('');
  const [schProceedingNo, setSchProceedingNo] = useState('');
  const [schAmount, setSchAmount] = useState('');
  const [schDate, setSchDate] = useState(''); // This was being used for sanction_date in some places, let's normalize
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
  const [selectedProceeding, setSelectedProceeding] = useState(null); // For edit mode

  // Helper to set form state from modal-like callers
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
    const fn = setters[k] || (() => {});
    fn(v);
  };

  const handleClearDashboard = () => {
    // Clear search inputs
    setRoll('');
    setApplicationNoInput('');
    setNameInput('');
    setNameResults([]);
    setRollError('');
    setSearchMode('roll');

    // Clear loaded student/session data
    localResetStudent();

    // Reset modal-related local state
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

    // Scroll back to the top of the dashboard for clarity
    smoothScrollToId('scholarship-dashboard-top', { behavior: 'smooth', block: 'start' });
  };

  


  useEffect(() => {
    if (!isClerkLoading && clerk && clerk.role !== 'scholarship') {
      toast.error('Access Denied');
    }
  }, [clerk, isClerkLoading]);

  // Date formatting helper (UI only)
  const toDmy = (val) => formatDate(val) || '-';

  // UI must not parse roll number; rely only on backend fields

  const handleLogout = () => {
    logoutScholarshipDashboard();
  };

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
    // Reuse existing roll search flow
    try {
      await fetchStudent();
    } catch {
      // fetchStudent already reports errors via toast
    }
  };

  const fetchStudent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Name search: only fetch list of candidates; selection will refetch by roll
    if (searchMode === 'name') {
      const term = String(nameInput || '').trim();
      if (term.length < 2) {
        toast.error('Enter at least 2 characters for name search');
        return;
      }
      setLoading(true);
      setNameResults([]);
      const id = toast.loading('Searching students by name...');
      try {
        const url = `/api/clerk/scholarship/search-by-name?name=${encodeURIComponent(term)}`;
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

    if (searchMode === 'roll') {
      if (!roll) return;
      // Enforce same client-side constraints as LoginPanel / Admission clerk
      if (String(roll).length !== MAX_ROLL) {
        toast.error(`Roll Number must be ${MAX_ROLL} characters long`);
        return;
      }
      try {
        const { isValid } = validateRollNo(String(roll));
        if (!isValid) {
          toast.error('Invalid Roll Number format');
          return;
        }
      } catch (err) {
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
      if (searchMode === 'roll') {
        res = await fetch(`/api/clerk/scholarship/summary/${encodeURIComponent(roll)}`);
        data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'Student not found');
        payload = (data && data.data) ? data.data : data;
        setField('student', payload.student || null);
        setField('feeSummary', payload.fee_summary || null);
        setScholarshipProceedings(Array.isArray(payload.scholarship_proceedings) ? payload.scholarship_proceedings : []);
        setStudentPayments(Array.isArray(payload.student_payments) ? payload.student_payments : []);

        // Build 4-year list from admission academic year period (e.g., 2023-2027)
        const list = deriveYearsFromAdmission(String(payload?.student?.admission_year || ''));
        setField('yearList', list);
        // Fetch summaries for each year in parallel; store by year
        const urls = list.map(y => `/api/clerk/scholarship/summary/${encodeURIComponent(roll)}?year=${encodeURIComponent(y)}`);
        const results = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));
        const byYear = {};
        results.forEach((res, idx) => {
          const y = list[idx];
          const raw = (res.status === 'fulfilled' ? res.value : null) || null;
          byYear[y] = raw && raw.data ? raw.data : raw;
        });
        setField('summariesByYear', byYear);
        // Default collapsed view for all cards
        setField('expandedByYear', list.reduce((acc, y) => { acc[y] = false; return acc; }, {}));
      } else {
        // Application number search — expects { student, year_records }
        res = await fetch(`/api/clerk/scholarship/application/${encodeURIComponent(applicationNoInput)}`);
        data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'Student not found');
        payload = (data && data.data) ? data.data : data;
        setField('student', payload.student || null);
        // If backend provided per-year records, use them directly
        if (payload.year_records && typeof payload.year_records === 'object') {
          const years = Object.keys(payload.year_records || {});
          setField('yearList', years);
          setField('summariesByYear', payload.year_records);
          setField('expandedByYear', years.reduce((acc, y) => { acc[y] = false; return acc; }, {}));
        } else {
          // Fallback to derive from student
          const list = deriveYearsFromAdmission(String(payload?.student?.admission_year || ''));
          setField('yearList', list);
          setField('expandedByYear', list.reduce((acc, y) => { acc[y] = false; return acc; }, {}));
        }
      }

      toast.success('Student loaded', { id });
    } catch (err) {
      toast.error(err.message || 'Failed to fetch student', { id });
    } finally {
      setLoading(false);
    }
  };

  // Derive 4 academic years (YYYY-YY) from an admission period like "2023-2027"
  function deriveYearsFromAdmission(period) {
    const m = String(period).match(/^(\d{4})-(\d{4})$/);
    if (!m) return [];
    const start = parseInt(m[1], 10);
    // Generate Year 1..4 as YYYY-YY
    return [0,1,2,3].map(offset => {
      const s = start + offset;
      const e = s + 1;
      return `${s}-${String(e).slice(-2)}`;
    });
  }

  // Determine canonical record state for a year from backend summary or fallbacks.
  // Returns 'NO_RECORD' | 'PENDING' | 'COMPLETED'
  function computeRecordState(summary, globalFeeSummary) {
    // If no summary object at all, there are no DB rows for this year
    if (!summary) return 'NO_RECORD';

    const hasScholar = Array.isArray(summary.scholarship_proceedings) && summary.scholarship_proceedings.length > 0;
    const hasPayments = Array.isArray(summary.student_payments) && summary.student_payments.length > 0;
    const hasApplication = !!(summary.application_no && String(summary.application_no).trim() !== '');

    if (!hasScholar && !hasPayments && !hasApplication) return 'NO_RECORD';

    // Prefer explicit record_state from backend if provided
    if (summary.record_state && ['NO_RECORD', 'PENDING', 'COMPLETED'].includes(summary.record_state)) return summary.record_state;

    // Try to derive from fee_summary.pending_fee (if present)
    const fs = summary.fee_summary || {};
    let pending = fs.pending_fee;

    // If pending not available, use globalFeeSummary total_fee as fallback and assume nothing paid
    if (pending == null) {
      const total = fs.total_fee ?? globalFeeSummary?.total_fee ?? null;
      if (total == null) {
        // We have records but no fee numbers -> treat as PENDING to force clerk attention
        return 'PENDING';
      }
      // No payments recorded: pending equals total
      pending = total;
    }

    const pendingNum = Number(pending);
    if (!isNaN(pendingNum) && pendingNum === 0) return 'COMPLETED';
    return 'PENDING';
  }

  function openAddModal(year) {
    setModalYear(year);
    setModalOpen(true);
    // Reset fields
    try {
      const existingApp = (summariesByYear[year]?.application_no) || '';
      setSchAppNo(existingApp);
      setAppEditing(false);
    } catch { setSchAppNo(''); setAppEditing(false); }
    // Clear proceeding entry fields (Institutional workflow: new entry per row)
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
    // Thumb fields - hydrate from stored summary and normalize values
    try {
      const summaryData = summariesByYear[year] || {};
      const thumbAvailable = summaryData?.thumb_update_available === 1 || summaryData?.thumb_update_available === true;
      const thumbStatusRaw = summaryData?.thumb_status ?? 'PENDING';
      const ts = String(thumbStatusRaw).toLowerCase();
      const completeValues = ['complete', 'completed', '1', 'true', 'success', 'done'];
      const thumbStatusNorm = completeValues.includes(ts) ? 'COMPLETED' : 'PENDING';
      // initialize via setFormState so modal setter API is used
      setFormState('thumbUpdateAvailable', thumbAvailable);
      setFormState('thumbStatus', thumbStatusNorm);
    } catch {
      setFormState('thumbUpdateAvailable', false);
      setFormState('thumbStatus', 'PENDING');
    }
    // Hardcopy submission flag
    try {
      const summaryData = summariesByYear[year] || {};
      const hardcopy = summaryData?.hardcopy_submitted === 1 || summaryData?.hardcopy_submitted === true;
      setFormState('hardcopySubmitted', hardcopy);
    } catch {
      setFormState('hardcopySubmitted', false);
    }
  }

  async function refetchYearSummary(rollNo, year) {
    try {
      const res = await fetch(`/api/clerk/scholarship/summary/${encodeURIComponent(rollNo)}?year=${encodeURIComponent(year)}`);
      const data = res.ok ? await res.json() : null;
      const payload = data && data.data ? data.data : data;
      setField('summariesByYear', {
        ...summariesByYear,
        [year]: payload,
      });
    } catch {}
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
        thumb_status: thumbStatus || 'Pending',
        hardcopy_submitted: hardcopySubmitted ? 1 : 0,
        original_version: selectedProceeding ? selectedProceeding.version : undefined
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Proceeding Save Payload:', sanctionBody);
      }

      const res = await fetch('/api/clerk/scholarship/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanctionBody)
      });
      const data = await res.json();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Proceeding Save Response:', { status: res.status, data });
      }

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

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Payment Save Payload:', paymentBody);
      }

      const res = await fetch('/api/clerk/scholarship/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody)
      });
      const data = await res.json();

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Payment Save Response:', { status: res.status, data });
      }

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
        hardcopy_submitted: hardcopySubmitted ? 1 : 0,
        thumb_update_available: !!thumbUpdateAvailable,
        thumb_status: thumbStatus || 'Pending'
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Final Update Payload:', updateBody);
      }

      const res = await fetch('/api/clerk/scholarship/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });
      const data = await res.json();

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Final Update Response:', { status: res.status, data });
      }

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
      const res = await fetch(`/api/clerk/scholarship/sanctions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
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
      const res = await fetch(`/api/clerk/scholarship/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to delete payment');
      }
      toast.success('Payment deleted');
      await refetchYearSummary(student.roll_no, modalYear);
    } catch (err) {
      toast.error(err.message || 'Failed to delete payment');
    }
  }


  if (isClerkLoading && !clerk) {
    return <LoadingSpinner label="Loading Dashboard" />;
  }

  if (!clerk) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 animate-fadeIn font-sans antialiased text-slate-600">
      <header id="scholarship-dashboard-top" className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5">
        <div className="space-y-1">
          <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.22em] opacity-90">Scholarship Operations</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Welcome, {firstName}</h1>
          <div className="flex items-center gap-3 mt-2 text-slate-600">
            <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{employeeId}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs font-medium uppercase tracking-tight">{roleLabel}</span>
          </div>
        </div>

        {view === 'certificates' ? (
          <button
            type="button"
            onClick={backToDashboard}
            className="px-6 py-2.5 bg-white text-slate-700 text-[12px] font-black uppercase tracking-widest rounded-md border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            Back to Dashboard
          </button>
        ) : (
          <button
            type="button"
            onClick={openProfile}
            className="px-6 py-2.5 bg-[#0b3578] text-white text-[12px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-[#0b3578]/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Open Profile
          </button>
        )}
      </header>

      {view === 'certificates' ? (
        <section id="certificate-section" className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Certificate Queue</h2>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Operational module</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-3 sm:p-6">
            <CertificateDashboard clerkType="scholarship" />
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Queue Pulse</h2>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Live status</span>
            </div>
            <ScholarshipMetricsCards refreshToken={metricsRefreshToken} />
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Primary Operations</h2>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Search • window • queue</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
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
                />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <ScholarshipWindowCard
                  onWindowUpdated={() => {
                    setMetricsRefreshToken((t) => t + 1);
                    smoothScrollToId('scholarship-dashboard-top', { behavior: 'smooth', block: 'start' });
                  }}
                />
              </div>
            </div>
          </section>

          {student && (
            <section className="space-y-6">
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
                setFormState={(k, v) => {
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
                  };
                  (setters[k] || (() => {}))(v);
                }}
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
        </>
      )}
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}

export default function ScholarshipDashboard() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading Scholarship Dashboard..." />}>
      <ScholarshipDashboardContent />
    </Suspense>
  );
}
