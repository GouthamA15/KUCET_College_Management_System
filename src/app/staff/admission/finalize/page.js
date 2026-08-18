"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import toast from "react-hot-toast";
import { useRouter } from 'next/navigation';
import { COLLEGE_CONFIG } from "@/lib/college-config";
import { validateRollNo, getIntakeYear } from "@/lib/rollNumber";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AdmissionModal } from "@/components/staff/requests/AdmissionModal";

function FinalizeAdmissionContent() {
    const router = useRouter();
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('CSE');
    const [selectedExam, setSelectedExam] = useState('TG EAPCET');
    const [joiningYear, setJoiningYear] = useState(getIntakeYear());
    const [rollNumbers, setRollNumbers] = useState({});
    const [finalizingId, setFinalizingId] = useState(null);
    const [generating, setGenerating] = useState(false);

    // Modal & Editing state
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditData] = useState({});
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchVerifiedDrafts = useCallback(async () => {
        if (!selectedBranch || !selectedExam) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/staff/admission/drafts?branch=${selectedBranch}&entrance_exam=${selectedExam}&status=PROCESSED&t=${Date.now()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch drafts.');
            setDrafts(data.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch, selectedExam]);

    useEffect(() => {
        const id = setTimeout(() => {
            fetchVerifiedDrafts();
        }, 0);

        return () => clearTimeout(id);
    }, [fetchVerifiedDrafts]);

    const fetchDetail = useCallback(async (id) => {
        setFetchingDetail(true);
        setIsEditing(false);
        setRejectionMode(false);
        setRejectionReason('');
        try {
            const res = await fetch(`/api/staff/admission/drafts/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch detail.');
            setDetail(data.data);
            setEditData(data.data);
            setSelectedDraftId(id);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setFetchingDetail(false);
        }
    }, []);

    const handleSaveEdit = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`/api/staff/admission/drafts/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update application.');
            }
            toast.success('Changes Saved Successfully');
            setDetail({ ...editForm });
            setIsEditing(false);
            fetchVerifiedDrafts();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!detail) return;
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection.');
            return;
        }

        setProcessing(true);
        const toastId = toast.loading('Rejecting application...');
        try {
            const res = await fetch(`/api/staff/admission/drafts/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: 'REJECTED', 
                    rejection_reason: rejectionReason 
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Rejection failed.');

            toast.success('Application Rejected Successfully', { id: toastId });
            setDetail(null);
            setSelectedDraftId(null);
            setRejectionMode(false);
            setRejectionReason('');
            fetchVerifiedDrafts();
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    const handleFieldChange = useCallback((name, value) => {
        let val = value;
        if (name === 'inter_diploma_marks' && val !== '' && val !== '.') {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                if (num > 1000) {
                    val = '1000';
                } else if (num < 0) {
                    val = '0';
                }
            }
        }
        setEditData(prev => ({ ...prev, [name]: val }));
    }, []);

    const handleRollNumberChange = (draftId, value) => {
        setRollNumbers(prev => ({ ...prev, [draftId]: value.toUpperCase() }));
    };

    const handleFinalize = async (draftId) => {
        const rollNo = rollNumbers[draftId];
        if (!rollNo) return;
        
        setFinalizingId(draftId);
        const toastId = toast.loading('Finalizing admission...');
        try {
            const res = await fetch(`/api/staff/admission/drafts/${draftId}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: rollNo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Finalization failed.');
            
            toast.success('Student Admitted Successfully!', { id: toastId });
            fetchVerifiedDrafts();
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setFinalizingId(null);
        }
    };

    const handleGenerateRollNumbers = async () => {
        if (drafts.length === 0) return;
        
        let targetYear = parseInt(joiningYear, 10);
        if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
          toast.error('Please specify a valid joining year (e.g. 2026)');
          return;
        }

        // For Lateral Entry (TG ECET), the roll number prefix usually corresponds to 
        // the year they join college (which is 1 year after the regular batch start)
        // However, the API expects the "joiningYear" which is then used as prefix.
        // If we want prefix 26 for TG ECET, we send 2026.
        // If the regulars of this batch joined in 2025 (prefix 25), then laterals joining in 2026 (prefix 26) 
        // are part of the same "2025-2029" batch.
        
        setGenerating(true);
        const toastId = toast.loading('Generating roll numbers...');
        try {
            const res = await fetch('/api/admissions/generate-roll-number', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch: selectedBranch,
                    examType: selectedExam,
                    joiningYear: targetYear,
                    count: drafts.length,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate roll numbers.');
            const list = data.rollNumbers || (data.rollNumber ? [data.rollNumber] : []);
            if (list.length !== drafts.length) throw new Error('Roll generation returned unexpected count');
            const nextMap = {};
            drafts.forEach((d, idx) => { nextMap[d.id] = String(list[idx]).toUpperCase(); });
            setRollNumbers(nextMap);
            toast.success('Roll numbers generated.', { id: toastId });
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    const getRollValidation = (rollNo, draft) => {
        if (!rollNo) return { isValid: false };
        const result = validateRollNo(rollNo);
        if (!result.isValid) return { isValid: false, error: 'Invalid Format' };
        if (result.branch !== draft.branch) return { isValid: false, error: `Branch Mismatch (Got ${result.branch})` };
        const expectedType = draft.entrance_exam === 'TG ECET' ? 'Lateral' : 'Regular';
        if (result.admissionType !== expectedType) return { isValid: false, error: `${draft.entrance_exam} must be ${expectedType}` };
        return { isValid: true };
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
            <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Finalize Admissions</h1>
                    <p className="text-sm text-gray-600 mt-1">Generate roll numbers and confirm final admissions</p>
                </div>
                <div>
                    <button
                        type="button"
                        onClick={() => router.push('/staff/admission/dashboard')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <span>&larr;</span> <span>Return to Dashboard</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 border border-gray-300 rounded-md shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 ">Workspace Filter</h2>
                  <p className="text-sm text-gray-500 mt-1 ">Select target branch and intake examination</p>
                </div>
                
                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 sm:w-40">
                      <label className="block text-sm font-medium text-gray-400 mb-1.5 ">Intake Exam</label>
                      <select 
                          value={selectedExam} 
                          onChange={e => setSelectedExam(e.target.value)} 
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all"
                      >
                          <option value="TG EAPCET">TG EAPCET</option>
                          <option value="TG ECET">TG ECET</option>
                      </select>
                    </div>
                    <div className="flex-1 sm:w-60">
                      <label className="block text-sm font-medium text-gray-400 mb-1.5 ">Target Branch</label>
                      <select 
                          value={selectedBranch} 
                          onChange={e => setSelectedBranch(e.target.value)} 
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all"
                      >
                          {COLLEGE_CONFIG.branches.map(b => <option key={b.code} value={b.name}>{b.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 sm:w-32">
                      <label className="block text-sm font-medium text-gray-400 mb-1.5 ">Entry Year</label>
                      <input 
                          type="number"
                          value={joiningYear} 
                          onChange={e => setJoiningYear(e.target.value)} 
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all"
                          placeholder="e.g. 2026"
                      />
                    </div>
                    <div className="flex-1 sm:w-56 sm:self-end">
                        <button
                            type="button"
                            onClick={handleGenerateRollNumbers}
                            disabled={loading || generating || drafts.length === 0}
                            className="w-full px-6 py-2 border-2 border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                        >
                            {generating ? 'Generating...' : 'Generate Roll Numbers'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-md overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-[10px] font-bold ">Accessing {selectedExam} Queue...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-24 text-gray-400">
                      <span className="text-5xl block mb-6 opacity-20">📂</span>
                      <h3 className="text-[10px] font-bold text-gray-800 ">No {selectedExam} drafts found</h3>
                      <p className="text-[10px] font-medium text-gray-500 mt-2 max-w-xs mx-auto">Verify new applications in the Requests Center to populate this registry.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-left border-collapse text-[11px]">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-5 w-16 border-r border-gray-200">ID</th>
                                        <th className="px-6 py-5 border-r border-gray-200 w-full">Applicant Identity</th>
                                        <th className="px-6 py-5 w-[18ch] border-r border-gray-200">Institutional Roll Number</th>
                                        <th className="px-6 py-5 text-right ">Operational Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {drafts.map((draft, index) => {
                                        const validation = getRollValidation(rollNumbers[draft.id], draft);
                                        const hasValue = !!rollNumbers[draft.id];

                                        return (
                                            <tr key={draft.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4 text-gray-400 font-bold border-r border-gray-100">{index + 1}</td>
                                                <td className="px-6 py-4 font-medium text-gray-800 border-r border-gray-100 ">
                                                    <div className="flex flex-col">
                                                        <span>{draft.name}</span>
                                                        <span className="text-[9px] text-gray-400 font-medium lowercase mt-0.5">{draft.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-r border-gray-100">
                                                    <div className="space-y-1.5 flex flex-col items-center">
                                                        <input 
                                                            type="text"
                                                            maxLength={12}
                                                            placeholder={draft.entrance_exam === 'TG ECET' ? "e.g. 235670901L" : "e.g. 23567T0901"}
                                                            value={rollNumbers[draft.id] || ''}
                                                            onChange={e => handleRollNumberChange(draft.id, e.target.value)}
                                                            className={`block w-[16ch] text-center px-2 py-2 border-2 text-sm font-medium focus:outline-none transition-all rounded-md tracking-widest ${
                                                                !hasValue ? 'border-gray-100 bg-gray-50' :
                                                                validation.isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                                                            }`}
                                                        />
                                                        {hasValue && !validation.isValid && (
                                                            <div className="text-[9px] text-rose-600 font-medium px-1 flex items-center gap-1 w-[16ch] leading-tight text-center">
                                                                ⚠️ {validation.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => fetchDetail(draft.id)}
                                                            disabled={fetchingDetail}
                                                            className="px-3 py-2 border-2 border-gray-800 text-gray-800 text-sm font-medium hover:bg-gray-50 rounded-md transition-all"
                                                        >
                                                            {selectedDraftId === draft.id && fetchingDetail ? '...' : 'View/Edit'}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleFinalize(draft.id)} 
                                                            disabled={!validation.isValid || finalizingId === draft.id} 
                                                            className="px-6 py-2 bg-[#0b3578] text-white rounded-md font-medium text-[10px] hover:bg-blue-900 shadow-lg shadow-blue-100 disabled:opacity-50 transition-all active:scale-95"
                                                        >
                                                            {finalizingId === draft.id ? 'Finalizing...' : 'Finalize'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50/50">
                            {drafts.map((draft, _index) => {
                                const validation = getRollValidation(rollNumbers[draft.id], draft);
                                const hasValue = !!rollNumbers[draft.id];
                                return (
                                    <div key={draft.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm">{draft.name}</span>
                                                <span className="text-[10px] text-gray-400 font-medium lowercase mt-0.5">{draft.email}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Institutional Roll Number</label>
                                            <div className="space-y-1.5">
                                                <input 
                                                    type="text"
                                                    maxLength={12}
                                                    placeholder={draft.entrance_exam === 'TG ECET' ? "e.g. 235670901L" : "e.g. 23567T0901"}
                                                    value={rollNumbers[draft.id] || ''}
                                                    onChange={e => handleRollNumberChange(draft.id, e.target.value)}
                                                    className={`block w-[16ch] text-center px-2 py-2 border-2 text-sm font-medium focus:outline-none transition-all rounded-md tracking-widest ${
                                                        !hasValue ? 'border-gray-100 bg-gray-50' :
                                                        validation.isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                                                    }`}
                                                />
                                                {hasValue && !validation.isValid && (
                                                    <div className="text-[9px] text-rose-600 font-medium px-1 flex items-center gap-1 w-[16ch] leading-tight text-center">
                                                        ⚠️ {validation.error}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2 border-t border-slate-100 mt-1">
                                            <button 
                                                onClick={() => fetchDetail(draft.id)}
                                                disabled={fetchingDetail}
                                                className="flex-1 py-2 border-2 border-gray-800 text-gray-800 text-xs font-bold hover:bg-gray-50 rounded-md transition-all uppercase"
                                            >
                                                {selectedDraftId === draft.id && fetchingDetail ? '...' : 'View/Edit'}
                                            </button>
                                            <button 
                                                onClick={() => handleFinalize(draft.id)} 
                                                disabled={!validation.isValid || finalizingId === draft.id} 
                                                className="flex-1 py-2 bg-[#0b3578] text-white rounded-md font-bold text-xs uppercase hover:bg-blue-900 shadow-lg shadow-blue-100 disabled:opacity-50 transition-all active:scale-95"
                                            >
                                                {finalizingId === draft.id ? 'Finalizing...' : 'Finalize'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Audit Modal */}
            {detail && (
                <AdmissionModal
                    detail={{ ...detail, ...editForm }}
                    editForm={editForm}
                    isEditing={isEditing}
                    onFieldChange={handleFieldChange}
                    onToggleEditing={() => {
                        setIsEditing(prev => {
                            const next = !prev;
                            if (!prev && detail) setEditData(detail);
                            return next;
                        });
                    }}
                    onClose={() => setDetail(null)}
                    onSave={handleSaveEdit}
                    onReject={handleReject}
                    processing={processing}
                    rejectionMode={rejectionMode}
                    setRejectionMode={setRejectionMode}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                />
            )}
        </div>
    );
}

export default function FinalizeAdmissionPage() {
    return (
        <Suspense fallback={<LoadingSpinner label="Initializing Finalization Registry..." />}>
            <FinalizeAdmissionContent />
        </Suspense>
    );
}
