'use client';
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { useClerk } from '@/context/ClerkContext';
import { getAssetUrl } from '@/lib/assets';

// Only Blood Group uses dropdown options; other fields are plain inputs
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const AdmissionRequestsPanel = () => {
    const { admissionDrafts, isLoadingRequests, refreshAdmissionDrafts } = useClerk();
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    // Rejection state
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditData] = useState({});

    const drafts = admissionDrafts || [];
    const loading = isLoadingRequests && drafts.length === 0;

    const fetchDetail = useCallback(async (id) => {
        setFetchingDetail(true);
        setIsEditing(false);
        setRejectionMode(false);
        setRejectionReason('');
        try {
            const res = await fetch(`/api/clerk/admission/drafts/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch detail.');
            setDetail(data.data);
            setEditData(data.data); // Initialize edit form
            setSelectedDraftId(id);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setFetchingDetail(false);
        }
    }, []);

    const handleReject = async () => {
        if (!detail) return;
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection.');
            return;
        }

        setProcessing(true);
        const toastId = toast.loading('Rejecting application...');
        try {
            const res = await fetch(`/api/clerk/admission/drafts/${detail.id}`, {
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
            refreshAdmissionDrafts();
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    const handleVerify = async () => {
        if (!detail) return;
        setProcessing(true);
        try {
            // 1) Persist edited fields (full update)
            if (editForm && Object.keys(editForm).length > 0) {
                const saveRes = await fetch(`/api/clerk/admission/drafts/${detail.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm),
                });
                const saveData = await saveRes.json();
                if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save changes before verification.');
            }

            // 2) Update status to PROCESSED (status-only path in API)
            const statusRes = await fetch(`/api/clerk/admission/drafts/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PROCESSED' }),
            });
            const statusData = await statusRes.json();
            if (!statusRes.ok) throw new Error(statusData.error || 'Update failed.');

            toast.success('Application Verified Successfully!');
            // Clear editing state and refresh list so draft disappears from DRAFT queue
            setDetail(null);
            setSelectedDraftId(null);
            setIsEditing(false);
            setEditData({});
            refreshAdmissionDrafts();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveEdit = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`/api/clerk/admission/drafts/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update application.');
            }
            toast.success('Changes Saved Successfully');
            // Refresh detail view
            setDetail({ ...editForm });
            setIsEditing(false);
            refreshAdmissionDrafts();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setProcessing(false);
        }
    };

    // Stable field change handler to avoid recreating functions per render
    const handleFieldChange = useCallback((name, value) => {
        setEditData(prev => ({ ...prev, [name]: value }));
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Admission Queue</h2>
                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-1 tracking-wider">Review new intake applications</p>
                </div>
                                <button onClick={refreshAdmissionDrafts} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all rounded-sm shadow-sm">
                    <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Sync
                </button>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">Accessing Intake Records...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <span className="text-4xl block mb-4 opacity-20">📂</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">No pending intake applications found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 border-r border-slate-200">Applicant Name</th>
                                <th className="px-6 py-4 border-r border-slate-200">Father&apos;s Designation</th>
                                <th className="px-6 py-4 border-r border-slate-200">Entrance Credentials</th>
                                <th className="px-6 py-4 text-right uppercase tracking-widest">Operational Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {drafts.map(draft => (
                                <tr key={draft.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 border-r border-slate-100 font-bold text-slate-900 uppercase">{draft.name}</td>
                                    <td className="px-6 py-4 border-r border-slate-100 font-medium text-slate-600 uppercase">{draft.father_name}</td>
                                    <td className="px-6 py-4 border-r border-slate-100 text-slate-600 font-bold">
                                        <span className="mr-2 uppercase tracking-tight">{draft.entrance_exam}</span>
                                        <span className="text-[#0b3578] bg-blue-50 px-2 py-0.5 border border-blue-100 rounded-full">RANK {draft.exam_rank}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => fetchDetail(draft.id)}
                                            disabled={fetchingDetail}
                                            className="px-4 py-1.5 border-2 border-slate-800 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-60 transition-all rounded-sm shadow-sm"
                                        >
                                            {selectedDraftId === draft.id && fetchingDetail ? 'AUDITING...' : 'VIEW & VERIFY'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

            {/* Verification & Edit Modal */}
            {detail && (
                <AdmissionModal
                    detail={{ ...detail, ...editForm }}
                    editForm={editForm}
                    isEditing={isEditing}
                    onFieldChange={handleFieldChange}
                    onToggleEditing={() => {
                        setIsEditing(prev => {
                            const next = !prev;
                            if (!prev && detail) {
                                setEditData(detail);
                            }
                            return next;
                        });
                    }}
                    onClose={() => setDetail(null)}
                    onSave={handleSaveEdit}
                    onVerify={handleVerify}
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
};

// ---------- Shared, memoized editable field ----------

const EditableField = React.memo(function EditableField({
    label,
    name,
    type = 'text',
    fullWidth = false,
    options = null,
    inputMode,
    maxLength,
    isEditing,
    value,
    onChange,
}) {
    const handleChange = useCallback(
        (e) => {
            onChange(name, e.target.value);
        },
        [name, onChange]
    );

    const baseClass = 'block w-full border px-3 py-2 text-xs font-bold transition-all rounded-sm';
    const activeClass = 'border-blue-400 bg-white focus:ring-2 focus:ring-blue-100 outline-none uppercase shadow-sm';
    const readOnlyClass = 'border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-tight';

    return (
        <div className={`${fullWidth ? 'md:col-span-2 col-span-1' : ''}`}>
            <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">{label}</label>
            {options ? (
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                >
                    <option value="">SELECT</option>
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o.toUpperCase()}
                        </option>
                    ))}
                </select>
            ) : type === 'textarea' ? (
                <textarea
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    rows={3}
                    maxLength={maxLength}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass} resize-none`}
                />
            ) : (
                <input
                    type={type}
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                />
            )}
        </div>
    );
});

// ---------- Modal and sections (government-style, flat UI) ----------

function MediaSection({ detail, isEditing, onFieldChange }) {
    const handleFileChange = (e, name) => {
        const file = e.target.files[0];
        if (!file) return;

        // Size check (4MB)
        if (file.size > 4 * 1024 * 1024) {
            toast.error('File size exceeds 4MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            onFieldChange(name, reader.result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-6">
            <div className="border border-slate-200 bg-white p-4 shadow-sm rounded-sm">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identification Photo</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-200 hover:bg-blue-100 transition-all uppercase tracking-widest">
                            Replace
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'pfp')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
                    {detail.pfp ? (
                        <div className="w-full h-full relative">
                            <Image src={getAssetUrl(detail.pfp)} alt="Student Photo" fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">No Record Found</span>
                    )}
                </div>
            </div>
            <div className="border border-slate-200 bg-white p-4 shadow-sm rounded-sm">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specimen Signature</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-200 hover:bg-blue-100 transition-all uppercase tracking-widest">
                            Replace
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'signature')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full h-24 bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {detail.signature ? (
                        <div className="w-full h-full relative p-2">
                            <Image src={getAssetUrl(detail.signature)} alt="Signature" fill className="object-contain" unoptimized />
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">No Record Found</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function PersonalDetailsSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">01</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Primary Identity Record</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField label="Full Name" name="name" value={editForm.name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Gender" name="gender" value={editForm.gender} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Father's Name" name="father_name" value={editForm.father_name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Mother's Name" name="mother_name" value={editForm.mother_name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Date of Birth" name="dob" type="date" value={editForm.dob} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Nationality" name="nationality" value={editForm.nationality} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Religion" name="religion" value={editForm.religion} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Mother Tongue" name="mother_tongue" value={editForm.mother_tongue} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField
                    label="Blood Group"
                    name="blood_group"
                    options={BLOOD_GROUP_OPTIONS}
                    value={editForm.blood_group}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Aadhaar Number"
                    name="aadhaar_no"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={editForm.aadhaar_no}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>
        </section>
    );
}

function AcademicSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">02</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Academic & Institutional Credentials</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField
                    label="Entrance Exam"
                    name="entrance_exam"
                    value={editForm.entrance_exam}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Entrance Rank"
                    name="exam_rank"
                    type="number"
                    value={editForm.exam_rank}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="SSC / 10th Marks"
                    name="ssc_marks"
                    value={editForm.ssc_marks}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Inter / Diploma Marks"
                    name="inter_diploma_marks"
                    value={editForm.inter_diploma_marks}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Branch Preference"
                    name="branch"
                    options={COLLEGE_CONFIG.branches.map((b) => b.name)}
                    value={editForm.branch}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Social Category"
                    name="category"
                    options={COLLEGE_CONFIG.categories}
                    value={editForm.category}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Sub Caste"
                    name="sub_caste"
                    value={editForm.sub_caste}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Seat Allotted Under"
                    name="seat_allotted_category"
                    value={editForm.seat_allotted_category}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Area Residence Status"
                    name="area_status"
                    options={['Local', 'Non Local']}
                    value={editForm.area_status}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Fee Reimbursement Authorization"
                    name="fee_reimbursement"
                    options={['YES', 'NO', 'GOV']}
                    value={editForm.fee_reimbursement}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>
        </section>
    );
}

function ContactSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">03</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Contact & Communication Registry</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField
                    label="Primary Mobile No"
                    name="student_mobile"
                    value={editForm.student_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Guardian Mobile No"
                    name="guardian_mobile"
                    value={editForm.guardian_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Digital Mail Identity"
                    name="email"
                    fullWidth
                    value={editForm.email}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Visible Identification Mark 01"
                    name="identification_mark_1"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_1}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Visible Identification Mark 02"
                    name="identification_mark_2"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_2}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Legal Residential Address"
                    name="permanent_address"
                    type="textarea"
                    fullWidth
                    value={editForm.permanent_address}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>
        </section>
    );
}

function AdmissionModal({
    detail,
    editForm,
    isEditing,
    onFieldChange,
    onToggleEditing,
    onClose,
    onSave,
    onVerify,
    onReject,
    processing,
    rejectionMode,
    setRejectionMode,
    rejectionReason,
    setRejectionReason,
}) {
    const modal = (
        <div className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm flex items-stretch justify-center p-4">
            <div className="bg-slate-50 border border-slate-300 w-full max-w-6xl h-full flex flex-col shadow-2xl rounded-sm animate-fadeInUp">
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Audit Environment</div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Institutional Admission Review</h2>
                        <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">
                          Applicant: <span className="text-slate-800">{detail.name}</span> • Year {detail.admission_year} • Intake Rank {detail.exam_rank}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!rejectionMode && (
                            <button
                                type="button"
                                onClick={onToggleEditing}
                                className="px-4 py-2 border-2 border-slate-800 bg-white text-[10px] font-black text-slate-800 uppercase tracking-widest hover:bg-slate-50 transition-all rounded-sm shadow-sm"
                            >
                                {isEditing ? '🔒 Lock Record' : '✍️ Edit Record'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center w-10 h-10 border-2 border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-sm shadow-sm"
                            aria-label="Close admission review modal"
                            title="Close"
                        >
                            <span className="text-lg leading-none font-black">×</span>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8">
                    {rejectionMode ? (
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto space-y-8 animate-fadeIn">
                            <div className="text-center space-y-3">
                                <span className="text-5xl block grayscale mb-2">🚫</span>
                                <h3 className="text-lg font-black text-rose-700 uppercase tracking-tight">Application Rejection Memo</h3>
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed uppercase tracking-wider">Specify professional reason for rejection. This memo will be dispatched to the applicant&apos;s registered electronic mail.</p>
                            </div>
                            <div className="w-full">
                                <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Rejection Rationale</label>
                                <textarea
                                    className="w-full border-2 border-slate-200 p-5 text-xs font-bold focus:border-rose-500 outline-none bg-white rounded-sm shadow-inner transition-all resize-none"
                                    rows={6}
                                    placeholder="e.g. Identity documentation mismatch, Illegible photography, or Credential verification failure."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                            <div className="flex w-full gap-4">
                                <button
                                    onClick={() => { setRejectionMode(false); setRejectionReason(''); }}
                                    className="flex-1 px-6 py-3 border-2 border-slate-200 bg-white text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-sm transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onReject}
                                    disabled={processing || !rejectionReason.trim()}
                                    className="flex-1 px-6 py-3 bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-800 disabled:opacity-50 rounded-sm shadow-lg shadow-rose-100 transition-all active:scale-95"
                                >
                                    {processing ? 'Processing...' : 'Authorize Rejection'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 h-full">
                            <div className="space-y-6">
                                <MediaSection detail={detail} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                            <div className="space-y-10">
                                <PersonalDetailsSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <AcademicSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <ContactSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!rejectionMode && (
                    <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => setRejectionMode(true)}
                            className="px-6 py-2.5 border-2 border-rose-100 bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all rounded-sm shadow-sm"
                        >
                            Issue Rejection
                        </button>
                        
                        <div className="flex gap-4">
                            {isEditing ? (
                                <button
                                    type="button"
                                    onClick={onSave}
                                    disabled={processing}
                                    className="px-8 py-2.5 border-2 border-amber-500 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-60 transition-all rounded-sm shadow-lg shadow-amber-100 active:scale-95"
                                >
                                    {processing ? 'Saving Audit...' : 'Commit Changes'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onVerify}
                                    disabled={processing}
                                    className="px-8 py-2.5 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 disabled:opacity-60 transition-all rounded-sm shadow-lg shadow-blue-100 active:scale-95"
                                >
                                    {processing ? 'Finalizing...' : 'Validate & Authenticate'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

export default AdmissionRequestsPanel;
