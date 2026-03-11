'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import { COLLEGE_CONFIG } from '@/lib/college-config';

// Only Blood Group uses dropdown options; other fields are plain inputs
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const AdmissionRequestsPage = () => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const fetchDrafts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/clerk/admission/drafts?status=DRAFT');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch drafts.');
            setDrafts(data.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

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
            fetchDrafts();
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
            fetchDrafts();
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
            fetchDrafts();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, [fetchDrafts]);

    // Stable field change handler to avoid recreating functions per render
    const handleFieldChange = useCallback((name, value) => {
        setEditData(prev => ({ ...prev, [name]: value }));
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />
            <Navbar role={'clerkAdmission'} />

            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Student Admission Requests</h1>
                    <button onClick={fetchDrafts} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium hover:bg-gray-100">
                        <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Refresh
                    </button>
                </div>

                <div className="bg-white border border-gray-300 overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
                            <p>Loading applications...</p>
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-medium">No pending requests found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left border border-gray-300 text-sm">
                            <thead className="bg-gray-100 text-gray-700 text-xs font-semibold border-b border-gray-300">
                                <tr>
                                    <th className="px-4 py-2 border-r border-gray-300 font-semibold">Student Name</th>
                                    <th className="px-4 py-2 border-r border-gray-300 font-semibold">Father&apos;s Name</th>
                                    <th className="px-4 py-2 border-r border-gray-300 font-semibold">Exam / Rank</th>
                                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {drafts.map(draft => (
                                    <tr key={draft.id}>
                                        <td className="px-4 py-2 border-r border-gray-200 font-medium text-gray-900">{draft.name}</td>
                                        <td className="px-4 py-2 border-r border-gray-200 text-gray-700">{draft.father_name}</td>
                                        <td className="px-4 py-2 border-r border-gray-200 text-gray-700">
                                            <span className="mr-1">{draft.entrance_exam}</span>
                                            <span className="text-gray-500">(Rank {draft.exam_rank})</span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button 
                                                onClick={() => fetchDetail(draft.id)}
                                                disabled={fetchingDetail}
                                                className="px-4 py-1 border border-gray-500 bg-white text-gray-800 text-xs font-medium hover:bg-gray-100 disabled:opacity-60"
                                            >
                                                {selectedDraftId === draft.id && fetchingDetail ? 'Loading...' : 'View & Verify'}
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
            </main>
            <Footer />
        </div>
    );
};

export default AdmissionRequestsPage;

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

    const baseClass = 'block w-full border px-2 py-1 text-sm';
    const activeClass = 'border-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-gray-600';
    const readOnlyClass = 'border-gray-300 bg-gray-100 text-gray-700';

    return (
        <div className={`${fullWidth ? 'md:col-span-2 col-span-1' : ''}`}>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
            {options ? (
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                >
                    <option value="">Select</option>
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o}
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
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass} resize-y`}
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
        <div className="space-y-4">
            <div className="border border-gray-300 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Photograph</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200 hover:bg-indigo-100">
                            Upload
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'pfp')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center" style={{ aspectRatio: '3 / 4' }}>
                    {detail.pfp ? (
                        <div className="w-full h-full relative">
                            <Image src={detail.pfp} alt="Student Photo" fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <span className="text-xs text-gray-500">No photo</span>
                    )}
                </div>
            </div>
            <div className="border border-gray-300 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Signature</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200 hover:bg-indigo-100">
                            Upload
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'signature')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full h-20 bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                    {detail.signature ? (
                        <div className="w-full h-full relative">
                            <Image src={detail.signature} alt="Signature" fill className="object-contain" unoptimized />
                        </div>
                    ) : (
                        <span className="text-xs text-gray-500">No signature</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function PersonalDetailsSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-gray-300 bg-white p-3 space-y-3">
            <div className="border-b border-gray-200 pb-1 mb-2">
                <h3 className="text-sm font-semibold text-gray-800">1. Personal Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <EditableField label="Full Name" name="name" value={editForm.name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Gender" name="gender" value={editForm.gender} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Father&apos;s Name" name="father_name" value={editForm.father_name} isEditing={isEditing} onChange={onFieldChange} />
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
        <section className="border border-gray-300 bg-white p-3 space-y-3">
            <div className="border-b border-gray-200 pb-1 mb-2">
                <h3 className="text-sm font-semibold text-gray-800">2. Academic & Category</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    label="Branch"
                    name="branch"
                    options={COLLEGE_CONFIG.branches.map((b) => b.name)}
                    value={editForm.branch}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Category"
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
                    label="Seat Allotted Category"
                    name="seat_allotted_category"
                    value={editForm.seat_allotted_category}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Area Status"
                    name="area_status"
                    options={['Local', 'Non Local']}
                    value={editForm.area_status}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Fee Reimbursement"
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
        <section className="border border-gray-300 bg-white p-3 space-y-3">
            <div className="border-b border-gray-200 pb-1 mb-2">
                <h3 className="text-sm font-semibold text-gray-800">3. Contact & Identification</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <EditableField
                    label="Student Mobile"
                    name="student_mobile"
                    value={editForm.student_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Guardian Mobile"
                    name="guardian_mobile"
                    value={editForm.guardian_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Email ID"
                    name="email"
                    fullWidth
                    value={editForm.email}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Identification Mark 1"
                    name="identification_mark_1"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_1}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Identification Mark 2"
                    name="identification_mark_2"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_2}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Permanent Address"
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
    return (
        <div className="fixed inset-0 z-[60] bg-gray-200 flex items-stretch justify-center">
            <div className="bg-white border border-gray-400 w-full h-full sm:h-auto sm:max-w-5xl sm:my-8 sm:mx-4 flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-300 bg-gray-100 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">B.Tech Admission Request</div>
                        <div className="text-xs text-gray-600">
                            {detail.name} &mdash; Year {detail.admission_year} &mdash; Rank {detail.exam_rank}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!rejectionMode && (
                            <button
                                type="button"
                                onClick={onToggleEditing}
                                className="px-3 py-1 border border-gray-500 bg-white text-xs font-medium text-gray-800 hover:bg-gray-100"
                            >
                                {isEditing ? 'Lock Fields' : 'Enable Editing'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 border border-gray-500 bg-white text-xs font-medium text-gray-800 hover:bg-gray-100"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {rejectionMode ? (
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto space-y-6">
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-red-600 mb-2">Reject Admission Application</h3>
                                <p className="text-sm text-gray-600">Please provide a clear reason for rejection. This reason will be sent to the student&apos;s registered email address.</p>
                            </div>
                            <div className="w-full">
                                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Rejection Reason</label>
                                <textarea
                                    className="w-full border-2 border-red-100 p-3 text-sm focus:border-red-500 focus:outline-none bg-red-50/30 rounded-md"
                                    rows={6}
                                    placeholder="e.g. Photograph is not clear, or SSC marks do not match the uploaded document."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => { setRejectionMode(false); setRejectionReason(''); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onReject}
                                    disabled={processing || !rejectionReason.trim()}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 rounded-md shadow-md shadow-red-100"
                                >
                                    {processing ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
                            <div className="md:col-span-1">
                                <MediaSection detail={detail} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                            <div className="md:col-span-3 space-y-4">
                                <PersonalDetailsSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <AcademicSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <ContactSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!rejectionMode && (
                    <div className="px-4 py-3 border-t border-gray-300 bg-gray-100 flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setRejectionMode(true)}
                            className="px-4 py-1 border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 rounded"
                        >
                            Reject Application
                        </button>
                        
                        <div className="flex gap-3">
                            {isEditing ? (
                                <button
                                    type="button"
                                    onClick={onSave}
                                    disabled={processing}
                                    className="px-4 py-1 border border-gray-600 bg-white text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-60"
                                >
                                    {processing ? 'Saving…' : 'Save Changes'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onVerify}
                                    disabled={processing}
                                    className="px-4 py-1 border border-gray-600 bg-white text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-60"
                                >
                                    {processing ? 'Processing…' : 'Verify & Mark Processed'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
