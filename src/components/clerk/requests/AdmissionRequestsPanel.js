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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Admission Queue</h2>
                  <p className="text-sm text-gray-500 mt-1">Review new intake applications</p>
                </div>
                <button onClick={refreshAdmissionDrafts} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-md shadow-sm">
                    <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Sync
                </button>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-sm font-medium">Accessing Intake Records...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 border border-gray-200 rounded-md bg-white">
                        <p className="text-sm font-medium">No pending intake applications found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {drafts.map(draft => (
                            <div key={draft.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-300 rounded-md bg-white hover:border-gray-400 transition-colors gap-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-base">{draft.name}</h3>
                                    <p className="text-sm text-gray-600">Father: {draft.father_name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-700 font-medium">{draft.entrance_exam}</p>
                                    <span className="text-xs bg-blue-50 text-[#0b3578] px-2 py-1 rounded-md border border-blue-100 font-medium">
                                        Rank {draft.exam_rank}
                                    </span>
                                </div>
                                <div className="flex justify-end">
                                    <button 
                                        onClick={() => fetchDetail(draft.id)}
                                        disabled={fetchingDetail}
                                        className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors rounded-md cursor-pointer"
                                    >
                                        {selectedDraftId === draft.id && fetchingDetail ? 'Auditing...' : 'View & Verify'}
                                    </button>
                                </div>
                            </div>
                        ))}
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
