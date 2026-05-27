'use client';
import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useClerk } from '@/context/ClerkContext';
import { AdmissionModal } from './AdmissionModal';

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

    // Stable field change handler
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

export default AdmissionRequestsPanel;
