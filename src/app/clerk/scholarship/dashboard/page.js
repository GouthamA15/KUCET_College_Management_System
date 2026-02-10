"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
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
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold">Student Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      {(() => {
                        const p = student?.pfp;
                        const has = p && String(p).trim() !== '';
                        const isData = has && String(p).startsWith('data:');
                        const dataHasBody = !isData || (String(p).includes(',') && String(p).split(',')[1].trim() !== '');
                        if (has && dataHasBody) {
                          return (
                            <div className="mb-3">
                              <Image src={String(p)} alt="Profile Pic" width={96} height={96} onClick={(e) => { e.stopPropagation(); setImagePreviewSrc(String(p)); setImagePreviewOpen(true); }} className="w-24 h-24 object-cover rounded-full border-2 border-gray-300 cursor-pointer" />
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="text-sm text-gray-500">Roll Number</div>
                      <div className="font-medium">{student.roll_no}</div>
                      <div className="text-sm text-gray-500 mt-2">Student Name</div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-sm text-gray-500 mt-2">Fee Reimbursement</div>
                      <div className="font-medium">{student.fee_reimbursement}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Course</div>
                      <div className="font-medium">{student.course || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Admission Academic Year</div>
                      <div className="font-medium">{student.admission_year || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Current Academic Year</div>
                      <div className="font-medium">{student.current_year || '-'}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium">{student.email || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Mobile</div>
                      <div className="font-medium">{student.mobile || '-'}</div>
                    </div>
                  </div>
                </div>
                {/* Year-wise cards (4 cards, independent) */}
                <div className="space-y-4">
                  {yearList.map((y, idx) => {
                    const summary = summariesByYear[y] || null;
                    const status = summary?.fee_summary?.status || 'NO_RECORD';
                    const isCompleted = status === 'COMPLETED';
                    return (
                      <div key={y} className="bg-white rounded-lg shadow p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">Year {idx + 1}</h3>
                            <div className="text-sm text-gray-500">{y}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded ${status === 'COMPLETED' ? 'bg-green-100 text-green-800' : status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>{status}</span>
                            <button
                              onClick={() => setExpandedByYear(prev => ({ ...prev, [y]: !prev[y] }))}
                              className="px-3 py-1 rounded border"
                            >
                              {expandedByYear[y] ? 'Collapse' : 'Expand'}
                            </button>
                            {!isCompleted && (
                              (() => {
                                const summaryExists = Boolean((summariesByYear[y]?.application_no) || (Array.isArray(summariesByYear[y]?.scholarship_proceedings) && summariesByYear[y].scholarship_proceedings.length > 0));
                                const label = summaryExists ? 'Edit Record' : 'Add Record';
                                return (
                                  <button onClick={() => openAddModal(y)} className="px-3 py-1 rounded bg-indigo-600 text-white">{label}</button>
                                );
                              })()
                            )}
                          </div>
                        </div>

                        {expandedByYear[y] && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold">Fee Summary</h4>
                              {summary?.fee_summary ? (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="text-sm text-gray-500">Total Fee</div>
                                  <div className="text-sm font-medium">{summary.fee_summary.total_fee}</div>
                                  <div className="text-sm text-gray-500">Govt Paid</div>
                                  <div className="text-sm font-medium">{summary.fee_summary.govt_paid}</div>
                                  <div className="text-sm text-gray-500">Student Paid</div>
                                  <div className="text-sm font-medium">{summary.fee_summary.student_paid}</div>
                                  <div className="text-sm text-gray-500">Pending Fee</div>
                                  <div className="text-sm font-medium">{summary.fee_summary.pending_fee}</div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-600">No fee summary available.</div>
                              )}
                            </div>

                            <div>
                              <h4 className="font-semibold">Scholarship Proceedings</h4>
                              <div className="mt-2">
                                <div className="text-sm text-gray-500">Application Number</div>
                                <div className="text-sm font-medium">{summary?.application_no || '-'}</div>
                              </div>
                              {(student?.fee_reimbursement === 'YES' && Array.isArray(summary?.scholarship_proceedings)) ? (
                                summary.scholarship_proceedings.length > 0 ? (
                                  <div className="space-y-2 mt-2">
                                    {summary.scholarship_proceedings.map((p, i) => (
                                      <div key={i} className="flex items-center justify-between border rounded p-2">
                                        <div className="text-sm">{p.proceeding_no}</div>
                                        <div className="text-sm">{p.amount}</div>
                                        <div className="text-sm">{toDmy(p.date)}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-600 mt-2">No proceedings recorded.</div>
                                )
                              ) : (
                                <div className="text-sm text-gray-600 mt-2">Scholarship section hidden for non‑scholarship students.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Record Modal (logic-only; no save action) */}
                {modalOpen && (
                  <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <div className="bg-white rounded-lg p-6 w-full max-w-3xl">
                      <div className="flex justify-between items-center mb-3">
                        {(() => {
                          const summaryExists = Boolean((summariesByYear[modalYear]?.application_no) || (Array.isArray(summariesByYear[modalYear]?.scholarship_proceedings) && summariesByYear[modalYear].scholarship_proceedings.length > 0));
                          const label = summaryExists ? 'Edit Record' : 'Add Record';
                          return (<h3 className="text-lg font-semibold">{label} — {modalYear}</h3>);
                        })()}
                        <button onClick={() => setModalOpen(false)} className="px-3 py-1 border rounded">Close</button>
                      </div>
                      {(() => {
                        const summary = summariesByYear[modalYear] || null;
                        const isScholar = student?.fee_reimbursement === 'YES';
                        const isSfc = String(student?.fee_category).toUpperCase() === 'SFC';
                        const feeFieldsLocked = isScholar && !isSfc; // Scholarship + NON-SFC → locked
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Fee Particulars */}
                            <div className="p-4 bg-gray-50 rounded">
                              <h4 className="font-semibold mb-2">Fee Particulars</h4>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm text-gray-600">Total Fee</label>
                                  <div className="mt-1 px-3 py-2 border rounded w-full bg-white">{summary?.fee_summary?.total_fee ?? '-'}</div>
                                </div>
                                <div>
                                  <label className="block text-sm text-gray-600">Student Paid Amount</label>
                                  <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
                                </div>
                                <div>
                                  <label className="block text-sm text-gray-600">Transaction Ref (UTR/Challan)</label>
                                  <input value={payRef} onChange={(e) => setPayRef(e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
                                </div>
                                <div>
                                  <label className="block text-sm text-gray-600">Transaction Date</label>
                                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} disabled={feeFieldsLocked} className={`mt-1 px-3 py-2 border rounded w-full ${feeFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
                                </div>
                              </div>
                            </div>

                            {/* Scholarship Particulars */}
                            {isScholar && (
                              <div className="p-4 bg-gray-50 rounded">
                                <h4 className="font-semibold mb-2">Scholarship Particulars</h4>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm text-gray-600">Application Number</label>
                                    <div className="relative">
                                      {(() => {
                                        const existingVal = String(summariesByYear[modalYear]?.application_no || '').trim();
                                        const hasExisting = existingVal !== '';
                                        return (
                                          <>
                                          <input
                                            value={schAppNo}
                                            onChange={(e) => setSchAppNo(e.target.value)}
                                            disabled={!appEditing && hasExisting}
                                            className={`mt-1 px-3 py-2 border rounded w-full ${(!appEditing && hasExisting) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                          />
                                          {hasExisting && (
                                            <div className="mt-1 text-xs text-amber-700">Existing Application Number found. Editing should be done with caution.</div>
                                          )}
                                          {hasExisting && (
                                            <div className="mt-2 flex items-center gap-2">
                                              {!appEditing ? (
                                                <button type="button" onClick={() => setAppEditing(true)} className="px-2 py-1 text-xs rounded border">Edit</button>
                                              ) : (
                                                <>
                                                  <button type="button" onClick={() => { setAppEditing(false); setSchAppNo(String(summariesByYear[modalYear]?.application_no || '')); }} className="px-2 py-1 text-xs rounded border">Cancel Edit</button>
                                                </>
                                              )}
                                            </div>
                                          )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-gray-600">Proceeding Number</label>
                                    <input value={schProceedingNo} onChange={(e) => setSchProceedingNo(e.target.value)} className="mt-1 px-3 py-2 border rounded w-full" />
                                    <div className="mt-1 text-xs text-gray-600">Proceeding number may be added later if not yet issued.</div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-gray-600">Sanctioned Amount</label>
                                    <input
                                      value={schAmount}
                                      onChange={(e) => setSchAmount(e.target.value)}
                                      disabled={!String(schProceedingNo || '').trim()}
                                      className={`mt-1 px-3 py-2 border rounded w-full ${!String(schProceedingNo || '').trim() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    />
                                    {!String(schProceedingNo || '').trim() && (
                                      <div className="mt-1 text-xs text-gray-600">Enter Proceeding Number to add sanctioned amount.</div>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-sm text-gray-600">Sanction Date</label>
                                    <input type="date" value={schDate} onChange={(e) => setSchDate(e.target.value)} className="mt-1 px-3 py-2 border rounded w-full" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Existing records with delete actions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="p-4 bg-white rounded border">
                          <h4 className="font-semibold mb-2">Existing Payments</h4>
                          {Array.isArray(summariesByYear[modalYear]?.student_payments) && summariesByYear[modalYear].student_payments.length > 0 ? (
                            <div className="space-y-2">
                              {summariesByYear[modalYear].student_payments.map((p) => (
                                <div key={p.id} className="flex items-center justify-between border rounded p-2">
                                  <div className="text-sm">{p.transaction_ref}</div>
                                  <div className="text-sm">{p.amount}</div>
                                  <div className="text-sm">{toDmy(p.date)}</div>
                                  <button onClick={() => deletePayment(p.id)} className="text-red-600 text-xs">Delete</button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">No payments recorded.</div>
                          )}
                        </div>
                        {student?.fee_reimbursement === 'YES' && (
                          <div className="p-4 bg-white rounded border">
                            <h4 className="font-semibold mb-2">Existing Scholarship Proceedings</h4>
                            {Array.isArray(summariesByYear[modalYear]?.scholarship_proceedings) && summariesByYear[modalYear].scholarship_proceedings.length > 0 ? (
                              <div className="space-y-2">
                                {summariesByYear[modalYear].scholarship_proceedings.map((s) => (
                                  <div key={s.id} className="flex items-center justify-between border rounded p-2">
                                    <div className="text-sm">{s.proceeding_no}</div>
                                    <div className="text-sm">{s.amount}</div>
                                    <div className="text-sm">{toDmy(s.date)}</div>
                                    <button onClick={() => deleteScholarship(s.id)} className="text-red-600 text-xs">Delete</button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">No proceedings recorded.</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end mt-4">
                        <button onClick={handleSaveRecord} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">
                          {saving ? 'Saving…' : 'Save Record'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
