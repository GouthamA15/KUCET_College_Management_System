"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';
import { getAdmissionTypeFromRoll, getBranchFromRoll, getAcademicYear, getAcademicYearForStudyYear } from '@/lib/rollNumber';

export default function ScholarshipDashboard() {
  const [roll, setRoll] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [feeDetails, setFeeDetails] = useState(null);
  const [scholarshipRecords, setScholarshipRecords] = useState([]);
  const [yearCount, setYearCount] = useState(4);
  const [expandedYear, setExpandedYear] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

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

      const academicYear = getAcademicYear(data.student.roll_no);
      if (academicYear) {
        const [start, end] = academicYear.split('-').map(Number);
        setYearCount(end - start);
      } else {
        setYearCount(4); // Default to 4 years if academic year is not available
      }

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
      ? { ...existing }
      : { year, application_no: '' };
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
        const ok = confirm('Changing the Application Number will change record type (Scholar ↔ Non-Scholar). Proceed?');
        if (!ok) return;
      }
    }

    setSaving(true);
    const id = toast.loading('Saving record...');
    try {
      const dataToSave = { ...form };
      // If proceedings number is provided (scholar), mark as Success.
      if (dataToSave.proceedings_no && String(dataToSave.proceedings_no).trim() !== '') {
        dataToSave.status = 'Success';
      } else if (type === 'non' && dataToSave.amount_paid && String(dataToSave.amount_paid).trim() !== '') {
        // For non-scholars, if Amount Paid is provided, mark status as Success
        dataToSave.status = 'Success';
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

  const yearStatus = (year) => {
    const rec = scholarshipRecords.find(r => Number(r.year) === Number(year));
    if (!rec) return { label: 'No Record', type: 'none' };
    if (String(rec.application_no) === String(student?.roll_no)) return { label: 'Non-Scholar', type: 'non' };
    return { label: 'Scholarship', type: 'scholar' };
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar clerkMode={true} onLogout={handleLogout} />
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Scholarship Clerk Dashboard</h1>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-4 rounded-lg shadow border-2 border-indigo-50 flex flex-col">
            <h3 className="font-semibold">Fetch Student</h3>
            <p className="text-sm text-gray-600">Primary action: fetch a student by roll number</p>
            <form onSubmit={fetchStudent} className="mt-3 flex gap-2">
              <input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll Number" className="flex-grow px-3 py-2 border rounded" />
              <button type="submit" disabled={!roll || loading} className="px-4 py-2 bg-indigo-700 text-white rounded disabled:opacity-60">{loading ? 'Fetching...' : 'Fetch'}</button>
            </form>
          </div>

          <div className={`${student ? 'bg-white' : 'bg-white opacity-60 pointer-events-none'} p-4 rounded-lg shadow border`}>
            <h3 className="font-semibold">Scholarship Records</h3>
            <p className="text-sm text-gray-600">Available after fetching a student</p>
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
                  <div className="font-medium">{getAcademicYear(student.roll_no) || '-'}</div>
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
                const year = idx + 1;
                const rec = scholarshipRecords.find(r => Number(r.year) === Number(year));
                const status = yearStatus(year);
                return (
                  <div key={year} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <h3 className="font-semibold">Year {year}</h3>
                        <div className="text-sm text-gray-500">{getAcademicYearForStudyYear(student.roll_no, year) || ''}</div>
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
                          const prevRec = scholarshipRecords.find(r => Number(r.year) === Number(year - 1));
                          const allowAdd = year === 1 || !!prevRec;
                          return (
                            <button
                              onClick={() => allowAdd && openModalForYear(year)}
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
                            <button onClick={() => { setExpandedYear(expandedYear === year ? null : year); }} className={`px-3 py-1 border rounded cursor-pointer transition transform duration-150 ${expandedYear === year ? 'scale-105' : ''}`}>{expandedYear === year ? 'Collapse' : 'Expand'}</button>
                            <button onClick={() => openModalForYear(year, rec)} className="px-3 py-1 bg-yellow-600 text-white rounded cursor-pointer transition duration-150 hover:scale-105">Edit Record</button>
                          </>
                        )}
                      </div>
                    </div>

                    {expandedYear === year && rec && (
                      <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slideDown">
                        {String(rec.application_no) === String(student.roll_no) ? (
                          <div>
                            <h4 className="font-semibold">Non-Scholar Payment</h4>
                            <div className="text-sm">UTR: {rec.utr_no || '-'}</div>
                            <div className="text-sm">UTR Date: {rec.utr_date || '-'}</div>
                            <div className="text-sm">Amount Paid: {rec.amount_paid ?? '-'}</div>
                            <div className="text-sm mt-2">Updated by: {rec.updated_by_name || rec.updated_by || '-'}</div>
                            <div className="text-sm">Updated on: {rec.updated_at || rec.created_at || '-'}</div>
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-semibold">Scholarship Particulars</h4>
                            <div className="text-sm">Application No: {rec.application_no}</div>
                            <div className="text-sm">Proceeding No: {rec.proceedings_no || '-'}</div>
                            <div className="text-sm">Amount Sanctioned: {rec.amount_sanctioned ?? '-'}</div>
                            <div className="text-sm">Amount Distributed: {rec.amount_disbursed ?? '-'}</div>
                            <div className="text-sm">Challan No: {rec.ch_no || '-'}</div>
                            <div className="text-sm">Date: {rec.date || '-'}</div>
                            <div className="text-sm mt-2">Updated by: {rec.updated_by_name || rec.updated_by || '-'}</div>
                            <div className="text-sm">Updated on: {rec.updated_at || rec.created_at || '-'}</div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-semibold">Fee Particulars</h4>
                          <div className="text-sm">Total Fee: {feeDetails?.total_fee ?? '-'}</div>
                          <div className="text-sm">Total Paid: {feeDetails?.total_paid ?? '-'}</div>
                          <div className="text-sm">Pending Fee: {feeDetails?.pending_fee ?? '-'}</div>
                          <div className="text-sm">Fee Reimbursement: {feeDetails?.fee_reimbursement ?? '-'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Modal for Add/Edit */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-3">{form.id ? 'Edit' : 'Add'} Record — Year {editingYear}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Application Number *</label>
                  <input value={form.application_no || ''} onChange={(e) => setForm({ ...form, application_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                </div>

                {/* show remaining fields only for Scholarship students (application_no != roll_no) */}
                {evaluateType(form.application_no) === 'scholar' && (
                  <div>
                    <label className="block text-sm text-gray-600">Proceedings Number</label>
                    <input value={form.proceedings_no || ''} onChange={(e) => setForm({ ...form, proceedings_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                  </div>
                )}

                {/* Scholarship fields (visible if scholar) */}
                {evaluateType(form.application_no) === 'scholar' && (
                  <>
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

                {/* Non-scholar fields */}
                {evaluateType(form.application_no) === 'non' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600">UTR Number</label>
                      <input value={form.utr_no || ''} onChange={(e) => setForm({ ...form, utr_no: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">UTR Date</label>
                      <input type="date" value={form.utr_date || ''} onChange={(e) => setForm({ ...form, utr_date: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Amount Paid</label>
                      <input value={form.amount_paid || ''} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} className="mt-1 px-3 py-2 border rounded w-full" />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded cursor-pointer">Cancel</button>
                <button onClick={saveRecord} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60 cursor-pointer">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
