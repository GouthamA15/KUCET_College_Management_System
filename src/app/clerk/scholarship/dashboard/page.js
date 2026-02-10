"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import StudentInfoCard from '@/components/clerk/scholarship/StudentInfoCard';
import YearRecordsList from '@/components/clerk/scholarship/YearRecordsList';
import AddEditRecordModal from '@/components/clerk/scholarship/AddEditRecordModal';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';


export default function ScholarshipDashboard() {
  const [clerk, setClerk] = useState(null);
  const [isClerkLoading, setIsClerkLoading] = useState(true); // For initial clerk auth check
  const [roll, setRoll] = useState('');
  const [rollError, setRollError] = useState('');
  const MAX_ROLL = 10;
  const [loading, setLoading] = useState(false); // For fetching student data
  const [student, setStudent] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [scholarshipProceedings, setScholarshipProceedings] = useState([]);
  const [studentPayments, setStudentPayments] = useState([]);
  const [yearList, setYearList] = useState([]);
  const [summariesByYear, setSummariesByYear] = useState({});
  const [expandedByYear, setExpandedByYear] = useState({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [view, setView] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalYear, setModalYear] = useState('');
  // Modal form state
  const [schAppNo, setSchAppNo] = useState('');
  const [schProceedingNo, setSchProceedingNo] = useState('');
  const [schAmount, setSchAmount] = useState('');
  const [schDate, setSchDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [appEditing, setAppEditing] = useState(false);


  useEffect(() => {
    const fetchClerkData = async () => {
      setIsClerkLoading(true);
      try {
        const res = await fetch('/api/clerk/me');
        const data = await res.json();
        if (res.ok) {
          if (data.role !== 'scholarship') {
            toast.error('Access Denied');
          } else {
            setClerk(data);
          }
        } else {
          toast.error(data.error || 'Failed to fetch clerk data.');
        }
      } catch (error) {
        toast.error('An unexpected error occurred while fetching clerk data.');
        console.error('Error fetching clerk data:', error);
      } finally {
        setIsClerkLoading(false);
      }
    };
    fetchClerkData();
  }, []);

  // Date formatting helper (UI only)
  const toDmy = (val) => formatDate(val) || '-';

  // UI must not parse roll number; rely only on backend fields

  const handleLogout = () => {
    document.cookie = 'clerk_auth=; Max-Age=0; path=/;';
    document.cookie = 'clerk_logged_in=; Max-Age=0; path=/;';
    sessionStorage.removeItem('clerk_authenticated');
    window.location.replace('/');
  };

  const resetStudent = () => {
    setStudent(null);
    setFeeSummary(null);
    setScholarshipProceedings([]);
    setStudentPayments([]);
    setYearList([]);
    setSummariesByYear({});
    setExpandedByYear({});
  };

  const fetchStudent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
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
    setLoading(true);
    resetStudent();
    const id = toast.loading('Fetching student...');
    try {
      // Expect backend to return exactly the frozen contract shape
      // No hardcoded academic year; server defaults to current academic year
      const res = await fetch(`/api/clerk/scholarship/summary/${encodeURIComponent(roll)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Student not found');
      setStudent(data.student);
      setFeeSummary(data.fee_summary || null);
      setScholarshipProceedings(Array.isArray(data.scholarship_proceedings) ? data.scholarship_proceedings : []);
      setStudentPayments(Array.isArray(data.student_payments) ? data.student_payments : []);

      // Build 4-year list from admission academic year period (e.g., 2023-2027)
      const list = deriveYearsFromAdmission(String(data?.student?.admission_year || ''));
      setYearList(list);
      // Fetch summaries for each year in parallel; store by year
      const urls = list.map(y => `/api/clerk/scholarship/summary/${encodeURIComponent(roll)}?year=${encodeURIComponent(y)}`);
      const results = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));
      const byYear = {};
      results.forEach((res, idx) => {
        const y = list[idx];
        byYear[y] = (res.status === 'fulfilled' ? res.value : null) || null;
      });
      setSummariesByYear(byYear);
      // Default collapsed view for all cards
      setExpandedByYear(list.reduce((acc, y) => { acc[y] = false; return acc; }, {}));

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
    // Prefill proceeding, amount, date if an existing proceeding is present
    try {
      const arr = Array.isArray(summariesByYear[year]?.scholarship_proceedings) ? summariesByYear[year].scholarship_proceedings : [];
      const latest = arr.length > 0 ? arr[arr.length - 1] : null;
      setSchProceedingNo(latest?.proceeding_no || '');
      setSchAmount(latest?.amount ? String(latest.amount) : '');
      setSchDate(latest?.date || '');
    } catch {
      setSchProceedingNo('');
      setSchAmount('');
      setSchDate('');
    }
    setPayAmount('');
    setPayRef('');
    setPayDate('');
  }

  async function refetchYearSummary(rollNo, year) {
    try {
      const res = await fetch(`/api/clerk/scholarship/summary/${encodeURIComponent(rollNo)}?year=${encodeURIComponent(year)}`);
      const data = res.ok ? await res.json() : null;
      setSummariesByYear(prev => ({ ...prev, [year]: data }));
    } catch {}
  }

  async function handleSaveRecord() {
    if (!student || !modalYear) return;
    setSaving(true);
    const ops = [];
    // Scholarship side
    const isScholar = student?.fee_reimbursement === 'YES';
    const isSfc = String(student?.fee_category).toUpperCase() === 'SFC';
    const feeFieldsLocked = isScholar && !isSfc;
    try {
      if (isScholar) {
        // Scholarship creation: Application Number is the only mandatory field
        // Proceeding Number remains OPTIONAL, but REQUIRED if a sanctioned amount is provided
        const hasScholarInputs = schProceedingNo || schAmount || schDate || schAppNo;
        if (hasScholarInputs) {
          if (!schAppNo) throw new Error('Application Number is required');
          const hasAmount = Number(schAmount) > 0;
          if (hasAmount && !String(schProceedingNo || '').trim()) {
            throw new Error('Proceeding Number is required to enter sanctioned amount');
          }
          const amt = hasAmount ? Number(schAmount) : null;
          ops.push(fetch('/api/clerk/scholarship/sanctions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roll_no: student.roll_no,
              academic_year: modalYear,
              application_no: schAppNo || null,
              proceeding_no: schProceedingNo || null,
              sanctioned_amount: amt,
              sanction_date: schDate || null,
            })
          }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error || 'Failed to save sanction')))));
        }
      }

      // Payment side
      if (!feeFieldsLocked) {
        const hasPaymentInputs = payAmount || payRef || payDate;
        if (hasPaymentInputs) {
          const pAmt = Number(payAmount);
          if (!(pAmt > 0)) throw new Error('Student Paid Amount must be > 0');
          if (!payRef) throw new Error('Transaction Ref is required');
          if (!payDate) throw new Error('Transaction Date is required');
          ops.push(fetch('/api/clerk/scholarship/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roll_no: student.roll_no,
              academic_year: modalYear,
              transaction_ref: payRef,
              amount: pAmt,
              transaction_date: payDate,
            })
          }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error || 'Failed to save payment')))));
        }
      }

      if (ops.length === 0) {
        throw new Error('No changes to save');
      }

      await Promise.all(ops);
      toast.success('Record saved');
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


  if (isClerkLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading scholarship dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar clerkMode={true} onLogout={handleLogout} />
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Scholarship Clerk Dashboard</h1>
        {view === 'certificates' ? (
          <div>
            <button onClick={() => setView('dashboard')} className="text-sm text-indigo-600 mb-3">← Back to Dashboard</button>
            <CertificateDashboard clerkType="scholarship" />
          </div>
        ) : (
          <>
            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-4 rounded-lg shadow border-2 border-indigo-50 flex flex-col">
                <h3 className="font-semibold">Fetch Student</h3>
                <p className="text-sm text-gray-600">Primary action: fetch a student by roll number</p>
                <form onSubmit={fetchStudent} className="mt-3 flex gap-2 items-center">
                  <div className="flex-grow min-w-0">
                    <input
                      value={roll}
                      onChange={(e) => {
                        const v = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setRoll(v);
                        if (v.length > 0 && v.length === MAX_ROLL) {
                          try {
                            const { isValid } = validateRollNo(v);
                            if (!isValid) setRollError('Invalid Roll Number format.');
                            else setRollError('');
                          } catch (err) {
                            setRollError('Invalid Roll Number format.');
                          }
                        } else if (v.length > 0 && v.length !== MAX_ROLL) {
                          setRollError(`Roll Number must be ${MAX_ROLL} characters long.`);
                        } else {
                          setRollError('');
                        }
                      }}
                      placeholder="Roll Number"
                      className="w-full px-3 py-2 border rounded"
                      maxLength={MAX_ROLL}
                    />
                    {rollError && <div className="text-red-600 text-sm mt-1">{rollError}</div>}
                  </div>
                  <button type="submit" disabled={loading || String(roll).length !== MAX_ROLL} className="px-4 py-2 bg-indigo-700 text-white rounded disabled:opacity-60 whitespace-nowrap flex-shrink-0 min-w-[90px] text-center">{loading ? 'Fetching...' : 'Fetch'}</button>
                </form>
              </div>

              <div onClick={() => setView('certificates')} role="button" tabIndex={0} className="cursor-pointer bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex flex-col">
                <h3 className="font-semibold">Certificate Requests</h3>
                <p className="text-sm text-gray-600">View and process student certificate requests.</p>
              </div>

              <div className="opacity-60 pointer-events-none bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold">Reports</h3>
                <p className="text-sm text-gray-500">Disabled — Coming Soon</p>
              </div>

              <div className="opacity-60 pointer-events-none bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-sm text-gray-500">Disabled — Coming Soon</p>
              </div>
            </div>

            {/* After fetch: Student Info + Summary */}
            {student && (
              <section className="space-y-6">
                {/* Student Info Card */}
                <StudentInfoCard student={student} onImageClick={(src) => { setImagePreviewSrc(src); setImagePreviewOpen(true); }} />
                {/* Year-wise cards (4 cards, independent) */}
                <YearRecordsList
                  yearList={yearList}
                  summariesByYear={summariesByYear}
                  expandedByYear={expandedByYear}
                  onToggleExpand={(yy) => setExpandedByYear(prev => ({ ...prev, [yy]: !prev[yy] }))}
                  onOpenModal={(yy) => openAddModal(yy)}
                  computeRecordState={computeRecordState}
                  feeSummary={feeSummary}
                  student={student}
                  toDmy={toDmy}
                />

                <AddEditRecordModal
                  open={modalOpen}
                  year={modalYear}
                  student={student}
                  summary={summariesByYear[modalYear] || null}
                  formState={{
                    schAppNo,
                    schProceedingNo,
                    schAmount,
                    schDate,
                    payAmount,
                    payRef,
                    payDate,
                    appEditing,
                  }}
                  setFormState={(k, v) => {
                    const setters = {
                      schAppNo: setSchAppNo,
                      schProceedingNo: setSchProceedingNo,
                      schAmount: setSchAmount,
                      schDate: setSchDate,
                      payAmount: setPayAmount,
                      payRef: setPayRef,
                      payDate: setPayDate,
                      appEditing: setAppEditing,
                    };
                    (setters[k] || (() => {}))(v);
                  }}
                  saving={saving}
                  onSave={handleSaveRecord}
                  onClose={() => setModalOpen(false)}
                  onDeletePayment={deletePayment}
                  onDeleteScholarship={deleteScholarship}
                  toDmy={toDmy}
                />
              </section>
            )}
          </>
        )}


        {/* UI is a pure renderer; edit modals removed per contract */}
      </main>
      <Footer />
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}
