"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import CertificateDashboard from '@/components/clerk/certificates/CertificateDashboard';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getAdmissionTypeFromRoll, getBranchFromRoll, getResolvedCurrentAcademicYear, getAcademicYearForStudyYear } from '@/lib/rollNumber';


export default function ScholarshipDashboard() {
  const [clerk, setClerk] = useState(null);
  const [isClerkLoading, setIsClerkLoading] = useState(true); // For initial clerk auth check
  const [roll, setRoll] = useState('');
  const [loading, setLoading] = useState(false); // For fetching student data
  const [student, setStudent] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [feeDetails, setFeeDetails] = useState(null);
  const [scholarshipRecords, setScholarshipRecords] = useState([]);
  const [yearCount, setYearCount] = useState(4);
  const [expandedYear, setExpandedYear] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [editingYear, setEditingYear] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingSaveData, setPendingSaveData] = useState(null);
  const [view, setView] = useState('dashboard');


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

  // Fee constants and helpers
  const SELF_FINANCE_BRANCHES = ['CSD', 'IT', 'CIVIL'];

  const isSelfFinanceBranch = (branch) => {
    if (!branch) return false;
    return SELF_FINANCE_BRANCHES.includes(String(branch).toUpperCase());
  };

  const computeTotalFee = (rollNo, application_no) => {
    const branch = getBranchFromRoll(rollNo);
    const isSelf = isSelfFinanceBranch(branch);
    const isScholar = (() => {
      if (!application_no) return false;
      return String(application_no).trim() !== String(rollNo);
    })();

    if (!isSelf) {
      return 35000;
    }

    // self finance
    return isScholar ? 35000 : 70000;
  };

  // Safe date formatter: renders DD-MM-YYYY without timezone shifts
  const toDmy = (val) => {
    if (!val) return '-';
    try {
      const s = String(val);
      const datePart = s.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        return `${d}-${m}-${y}`;
      }
      const ddmmyyyy = s.split('-');
      if (ddmmyyyy.length === 3 && ddmmyyyy[0].length === 2 && ddmmyyyy[1].length === 2 && ddmmyyyy[2].length === 4) {
        return s; // already DD-MM-YYYY
      }
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return String(val);
    }
  };

  // Calculate these once before the render loop if student data is available
  const admissionType = student ? getAdmissionTypeFromRoll(student.roll_no) : null;
  const displayYearOffset = (admissionType === 'Lateral') ? 1 : 0;

  const handleLogout = () => {
    document.cookie = 'clerk_auth=; Max-Age=0; path=/;';
    document.cookie = 'clerk_logged_in=; Max-Age=0; path=/;';
    sessionStorage.removeItem('clerk_authenticated');
    window.location.replace('/');
  };

  const resetStudent = () => {
    setStudent(null);
    setPersonal(null);
    setAcademic(null);
    setFeeDetails(null);
    setScholarshipRecords([]);
    setExpandedYear(null);
  };

  const fetchStudent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!roll) return;
    setLoading(true);
    resetStudent();
    const id = toast.loading('Fetching student...');
    try {
      const res = await fetch(`/api/clerk/scholarship/${encodeURIComponent(roll)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Student not found');

      setStudent(data.student);
      setPersonal(data.personal || {});
      setAcademic(data.academic || {});
      setFeeDetails(data.feeDetails || {});
      setScholarshipRecords(Array.isArray(data.scholarship) ? data.scholarship : []);

      // Determine course duration purely by admission type: Regular=4, Lateral=3
      const at = getAdmissionTypeFromRoll(data.student.roll_no) || 'Regular';
      setYearCount(String(at).toLowerCase() === 'lateral' ? 3 : 4);

      toast.success('Student loaded', { id });
    } catch (err) {
      toast.error(err.message || 'Failed to fetch student', { id });
    } finally {
      setLoading(false);
    }
  };

  const openModalForYear = (year, existing = null) => {
    setEditingYear(year);
    const base = existing
      ? { ...existing, amount_paid: existing.amount_paid ?? '', utr_no: existing.utr_no ?? '', utr_date: existing.utr_date ?? '' }
      : { year, application_no: '', amount_paid: '', utr_no: '', utr_date: '' };
    setForm(base);
    setModalOpen(true);
  };

  const evaluateType = (application_no) => {
    if (!application_no) return 'unknown';
    return String(application_no).trim() === String(student?.roll_no) ? 'non' : 'scholar';
  };

  useEffect(() => {
    if (!modalOpen) setForm({});
  }, [modalOpen]);

  const saveRecord = async () => {
    if (!form.application_no || form.application_no.toString().trim() === '') {
      toast.error('Application Number is required');
      return;
    }
    const type = evaluateType(form.application_no);

    // If changing type during edit, warn
    const existing = scholarshipRecords.find(s => Number(s.year) === Number(editingYear));
    if (existing) {
      const existingType = existing.application_no === student.roll_no ? 'non' : 'scholar';
      const newType = type;
      if (existingType !== newType) {
        // Open custom confirmation modal instead of native confirm
        setConfirmMessage('Changing the Application Number will change record type (Scholar ↔ Non‑Scholar). Proceed?');
        setPendingSaveData({ ...form });
        setConfirmOpen(true);
        return;
      }
    }

    setSaving(true);
    const id = toast.loading('Saving record...');
    try {
      const dataToSave = { ...form };

      // Compute fee, pending and status based on roll & application
      const totalFee = computeTotalFee(student.roll_no, dataToSave.application_no);
      const amountPaid = Number(String(dataToSave.amount_paid || '').trim() || 0);
      const pending = Math.max(0, Number(totalFee) - Number(amountPaid));
      dataToSave.total_fee = totalFee;
      dataToSave.pending_fee = pending;
      dataToSave.status = pending > 0 ? 'Pending' : 'Success';

      // If payment provided, ensure transaction id/date exist
      if (amountPaid > 0) {
        if (!dataToSave.utr_no || String(dataToSave.utr_no).trim() === '') {
          dataToSave.utr_no = 'TX' + Date.now().toString() + Math.random().toString(36).slice(2,6);
        }
        if (!dataToSave.utr_date || String(dataToSave.utr_date).trim() === '') {
          dataToSave.utr_date = new Date().toISOString().slice(0,10);
        }
      }

      // For scholarship records, keep amount_disbursed in sync with clerk-entered amount_paid when provided
      if (type === 'scholar') {
        if (!dataToSave.amount_disbursed && amountPaid > 0) dataToSave.amount_disbursed = amountPaid;
      }

      const payload = { scholarship: [ dataToSave ] };
      // If editing existing record include id
      if (existing && existing.id) payload.scholarship[0].id = existing.id;

      const res = await fetch(`/api/clerk/scholarship/${encodeURIComponent(roll)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success('Record saved', { id });
      setModalOpen(false);
      // Refresh
      await fetchStudent();
    } catch (err) {
      toast.error(err.message || 'Failed to save', { id });
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async () => {
    // require form.id to delete
    if (!form || !form.id) {
      toast.error('No record selected to delete');
      return;
    }
    // Use custom confirmation modal
    setConfirmMessage(`Delete scholarship record for year ${editingYear}? This action cannot be undone.`);
    setPendingSaveData({ action: 'delete', scholarship_id: form.id, delete_related_fees: false });
    setConfirmOpen(true);
  };

  // Called when user confirms type-change warning
  const confirmAndSave = async () => {
    setConfirmOpen(false);
    if (!pendingSaveData) return;
    const snapshot = { ...pendingSaveData };
    // handle delete action separately
    if (snapshot.action === 'delete') {
      setSaving(true);
      const id = toast.loading('Deleting record...');
      try {
        const payload = { scholarship_id: snapshot.scholarship_id, delete_related_fees: !!snapshot.delete_related_fees };
        const res = await fetch(`/api/clerk/scholarship/${encodeURIComponent(roll)}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        toast.success('Record deleted', { id });
        setModalOpen(false);
        await fetchStudent();
      } catch (err) {
        toast.error(err.message || 'Failed to delete', { id });
      } finally {
        setSaving(false);
        setPendingSaveData(null);
      }
      return;
    }

    // Otherwise, treat as a pending save (type-change confirmation) — reuse existing save logic
    try {
      setSaving(true);
      const id = toast.loading('Saving record...');

      const dataToSave = { ...snapshot };
      const type = evaluateType(dataToSave.application_no);
      const totalFee = computeTotalFee(student.roll_no, dataToSave.application_no);
      const amountPaid = Number(String(dataToSave.amount_paid || '').trim() || 0);
      const pending = Math.max(0, Number(totalFee) - Number(amountPaid));
      dataToSave.total_fee = totalFee;
      dataToSave.pending_fee = pending;
      dataToSave.status = pending > 0 ? 'Pending' : 'Success';

      if (amountPaid > 0) {
        if (!dataToSave.utr_no || String(dataToSave.utr_no).trim() === '') {
          dataToSave.utr_no = 'TX' + Date.now().toString() + Math.random().toString(36).slice(2,6);
        }
        if (!dataToSave.utr_date || String(dataToSave.utr_date).trim() === '') {
          dataToSave.utr_date = new Date().toISOString().slice(0,10);
        }
      }

      if (type === 'scholar') {
        if (!dataToSave.amount_disbursed && amountPaid > 0) dataToSave.amount_disbursed = amountPaid;
      }

      const payload = { scholarship: [ dataToSave ] };
      const existing = scholarshipRecords.find(s => Number(s.year) === Number(editingYear));
      if (existing && existing.id) payload.scholarship[0].id = existing.id;

      const res = await fetch(`/api/clerk/scholarship/${encodeURIComponent(roll)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success('Record saved', { id });
      setModalOpen(false);
      await fetchStudent();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
      setPendingSaveData(null);
    }
  };

  const yearStatus = (year) => {
    const rec = scholarshipRecords.find(r => Number(r.year) === Number(year));
    if (!rec) return { label: 'No Record', type: 'none' };
    if (String(rec.application_no) === String(student?.roll_no)) return { label: 'Non-Scholar', type: 'non' };
    return { label: 'Scholarship', type: 'scholar' };
  };

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
                  <input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll Number" className="flex-grow min-w-0 px-3 py-2 border rounded" />
                  <button type="submit" disabled={!roll || loading} className="px-4 py-2 bg-indigo-700 text-white rounded disabled:opacity-60 whitespace-nowrap flex-shrink-0 min-w-[90px] text-center">{loading ? 'Fetching...' : 'Fetch'}</button>
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

            {/* After fetch: Student Info + Year Cards */}
            {student && (
              <section className="space-y-6">
                {/* Student Info Card */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold">Student Information</h2>
                    <div className="text-sm text-gray-700">Admission Type: <span className="font-medium">{getAdmissionTypeFromRoll(student.roll_no) || 'Regular'}</span> ({yearCount} Years)</div>
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
                      <div className="text-sm text-gray-500 mt-2">Father Name</div>
                      <div className="font-medium">{personal?.father_name || '-'}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Religion</div>
                      <div className="font-medium">{personal?.religion || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Category</div>
                      <div className="font-medium">{personal?.category || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Annual Income</div>
                      <div className="font-medium">{personal?.annual_income ?? '-'}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Area Status</div>
                      <div className="font-medium">{personal?.area_status || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Qualifying Exam</div>
                      <div className="font-medium">{academic?.qualifying_exam || '-'}</div>
                      <div className="text-sm text-gray-500 mt-2">Course</div>
                      <div className="font-medium">{getBranchFromRoll(student.roll_no) || '-'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-500">Academic Year</div>
                      <div className="font-medium">{(() => { try { return getResolvedCurrentAcademicYear(student.roll_no); } catch { return '-'; } })()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Admission Type (detailed)</div>
                      <div className="font-medium">{getAdmissionTypeFromRoll(student.roll_no) || '-'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium">{student.email || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Address</div>
                      <div className="font-medium">{personal?.address || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Year-wise cards */}
                <div className="space-y-4">
                  {Array.from({ length: yearCount }).map((_, idx) => {
                    const collegeYear = idx + 1; // Year relative to college admission (1, 2, 3...)
                    const btechYear = collegeYear + displayYearOffset; // Year relative to B.Tech (1, 2, 3...)

                    const rec = scholarshipRecords.find(r => Number(r.year) === Number(collegeYear));
                    const status = yearStatus(collegeYear);
                    return (
                      <div key={collegeYear} className="bg-white rounded-lg shadow p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <h3 className="font-semibold">Year {btechYear}</h3>
                            <div className="text-sm text-gray-500">{getAcademicYearForStudyYear(student.roll_no, collegeYear) || ''}</div>
                            {(() => {
                              // prefer server-provided status color if available
                              const recStatus = rec && rec.status ? String(rec.status).trim() : null;
                              const isSuccess = recStatus && recStatus.toLowerCase() === 'success';
                              const isPending = recStatus && recStatus.toLowerCase() === 'pending';
                              let badgeClasses = 'px-2 py-1 text-xs rounded flex items-center';
                              let dotClasses = 'w-3 h-3 rounded-full mr-2 bg-gray-300';
                              if (isSuccess) {
                                badgeClasses += ' bg-green-100 text-green-800';
                                dotClasses = 'w-3 h-3 rounded-full mr-2 bg-green-500';
                              } else if (isPending) {
                                badgeClasses += ' bg-yellow-100 text-yellow-800';
                                dotClasses = 'w-3 h-3 rounded-full mr-2 bg-yellow-500';
                              } else if (status.type === 'none') {
                                badgeClasses += ' bg-gray-100 text-gray-700';
                                dotClasses = 'w-3 h-3 rounded-full mr-2 bg-gray-400';
                              } else if (status.type === 'non') {
                                badgeClasses += ' bg-yellow-100 text-yellow-800';
                                dotClasses = 'w-3 h-3 rounded-full mr-2 bg-yellow-500';
                              } else {
                                badgeClasses += ' bg-green-100 text-green-800';
                                dotClasses = 'w-3 h-3 rounded-full mr-2 bg-green-500';
                              }
                              return (
                                <span className={badgeClasses}>
                                  <span className={dotClasses} />
                                  <span>{status.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            {!rec && (() => {
                              const prevRec = scholarshipRecords.find(r => Number(r.year) === Number(collegeYear - 1));
                              const allowAdd = collegeYear === 1 || !!prevRec;
                              return (
                                <button
                                  onClick={() => allowAdd && openModalForYear(collegeYear)}
                                  disabled={!allowAdd}
                                  title={!allowAdd ? 'Please add previous year record first' : ''}
                                  className={`px-3 py-1 rounded ${allowAdd ? 'bg-indigo-600 text-white cursor-pointer' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                                >
                                  Add Record
                                </button>
                              );
                            })()}
                            {rec && (
                              <>
                                <button onClick={() => { setExpandedYear(expandedYear === collegeYear ? null : collegeYear); }} className={`px-3 py-1 border rounded cursor-pointer transition transform duration-150 ${expandedYear === collegeYear ? 'scale-105' : ''}`}>{expandedYear === collegeYear ? 'Collapse' : 'Expand'}</button>
                                <button onClick={() => openModalForYear(collegeYear, rec)} className="px-3 py-1 bg-yellow-600 text-white rounded cursor-pointer transition duration-150 hover:scale-105">Edit Record</button>
                              </>
                            )}
                          </div>
                        </div>

                        {expandedYear === collegeYear && rec && (
                          <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slideDown">
                            {String(rec.application_no) === String(student.roll_no) ? (
                              <div>
                                <h4 className="font-semibold">Non-Scholar Payment</h4>
                                <div className="text-sm">UTR: {rec.utr_no || '-'}</div>
                                <div className="text-sm">UTR Date: {toDmy(rec.utr_date) || '-'}</div>
                                <div className="text-sm">Amount Paid: {rec.amount_paid ?? '-'}</div>
                                <div className="text-sm mt-2">Updated by: {rec.updated_by_name || rec.updated_by || '-'}</div>
                                <div className="text-sm">Updated on: {toDmy(rec.updated_at) || toDmy(rec.created_at) || '-'}</div>
                              </div>
                            ) : (
                              <div>
                                <h4 className="font-semibold">Scholarship Particulars</h4>
                                <div className="text-sm">Application No: {rec.application_no}</div>
                                <div className="text-sm">Proceeding No: {rec.proceedings_no || '-'}</div>
                                <div className="text-sm">Amount Sanctioned: {rec.amount_sanctioned ?? '-'}</div>
                                <div className="text-sm">Amount Distributed: {rec.amount_disbursed ?? '-'}</div>
                                <div className="text-sm">Challan No: {rec.ch_no || '-'}</div>
                                <div className="text-sm">Date: {toDmy(rec.date) || '-'}</div>
                                <div className="text-sm mt-2">Updated by: {rec.updated_by_name || rec.updated_by || '-'}</div>
                                <div className="text-sm">Updated on: {toDmy(rec.updated_at) || toDmy(rec.created_at) || '-'}</div>
                              </div>
                            )}

                            <div>
                              <h4 className="font-semibold">Fee Particulars</h4>
                              {(() => {
                                const totalFee = computeTotalFee(student.roll_no, rec.application_no);
                                const totalPaid = Number(rec.amount_paid ?? rec.amount_disbursed ?? 0);
                                const pendingFee = Math.max(0, totalFee - totalPaid);
                                const txn = rec.utr_no || rec.ch_no || '-';
                                const txnDate = (toDmy(rec.utr_date) !== '-' ? toDmy(rec.utr_date) : (toDmy(rec.date) !== '-' ? toDmy(rec.date) : '-'));
                                const statusAuto = pendingFee > 0 ? 'Pending' : 'Success';
                                return (
                                  <>
                                    <div className="text-sm">Total Fee: {totalFee}</div>
                                    <div className="text-sm">Total Paid: {totalPaid ?? '-'}</div>
                                    <div className="text-sm">Pending Fee: {pendingFee}</div>
                                    <div className="text-sm">Transaction ID: {txn}</div>
                                    <div className="text-sm">Date: {txnDate}</div>
                                    <div className="text-sm">Status: {rec.status || statusAuto}</div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}


        {/* Modal for Add/Edit */}
        {modalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-3">{form.id ? 'Edit' : 'Add'} Record — Year {editingYear}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fee Particulars */}
                <div className="p-4 bg-gray-50 rounded">
                  <h4 className="font-semibold mb-2">Fee Particulars</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600">Total Fee (auto)</label>
                      <div className="mt-1 px-3 py-2 border rounded w-full bg-white">{student ? computeTotalFee(student.roll_no, form.application_no) : '-'}</div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600">Amount Paid</label>
                      <input value={form.amount_paid || ''} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600">UTR / Transaction ID</label>
                      <input value={form.utr_no || ''} onChange={(e) => setForm({ ...form, utr_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600">UTR Date</label>
                      <input type="date" value={form.utr_date || ''} onChange={(e) => setForm({ ...form, utr_date: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>
                  </div>
                </div>

                {/* Scholarship Particulars */}
                <div className="p-4 bg-gray-50 rounded">
                  <h4 className="font-semibold mb-2">Scholarship Particulars</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600">Application Number *</label>
                      <input value={form.application_no || ''} onChange={(e) => setForm({ ...form, application_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>

                    {evaluateType(form.application_no) === 'scholar' && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600">Proceedings Number</label>
                          <input value={form.proceedings_no || ''} onChange={(e) => setForm({ ...form, proceedings_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Amount Sanctioned</label>
                          <input value={form.amount_sanctioned || ''} onChange={(e) => setForm({ ...form, amount_sanctioned: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Amount Distributed</label>
                          <input value={form.amount_disbursed || ''} onChange={(e) => setForm({ ...form, amount_disbursed: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Challan Number</label>
                          <input value={form.ch_no || ''} onChange={(e) => setForm({ ...form, ch_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Date</label>
                          <input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded cursor-pointer">Cancel</button>
                {form && form.id && (
                  <button onClick={deleteRecord} disabled={saving} className="px-4 py-2 bg-red-600 cursor-pointer text-white rounded disabled:opacity-60">Delete</button>
                )}
                <button onClick={saveRecord} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60 cursor-pointer">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation dialog for type changes */}
        {confirmOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">Confirm Change</h3>
              <p className="text-sm text-gray-700 mb-4">{confirmMessage}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setConfirmOpen(false); setPendingSaveData(null); }} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={confirmAndSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded">Proceed</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
    </div>
  );
}
