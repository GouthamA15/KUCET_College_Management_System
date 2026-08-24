'use client';
import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { AdmissionModal } from './AdmissionModal';

const AdmissionRequestsPanel = () => {
    const { admissionDrafts, isLoadingRequests, refreshAdmissionDrafts } = useStaff();
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    React.useEffect(() => {
        refreshAdmissionDrafts();
    }, [refreshAdmissionDrafts]);
    
    // Rejection state
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditData] = useState({});

    const drafts = [...(admissionDrafts || [])].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return (b.id || 0) > (a.id || 0) ? 1 : -1;
    });
    const loading = isLoadingRequests && drafts.length === 0;

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
                const saveRes = await fetch(`/api/staff/admission/drafts/${detail.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm),
                });
                const saveData = await saveRes.json();
                if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save changes before verification.');
            }

            // 2) Update status to PROCESSED (status-only path in API)
            const statusRes = await fetch(`/api/staff/admission/drafts/${detail.id}`, {
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
            <div className="flex justify-between items-center px-1 mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Admission Queue</h2>
                  <p className="text-sm text-gray-500 mt-1">Review newly reported admission applications.</p>
                </div>
                <button 
                    onClick={refreshAdmissionDrafts} 
                    disabled={isLoadingRequests}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-md shadow-sm cursor-pointer"
                >
                    <span className={`inline-block ${isLoadingRequests ? 'animate-spin' : ''}`}>↻</span> 
                    {isLoadingRequests ? 'Syncing...' : 'Sync'}
                </button>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-sm font-medium">Accessing Intake Records...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-sm font-medium">No pending admission requests.</p>
                    </div>
                ) : (
                    <div className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Desktop Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 bg-white/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-4">Student Name</div>
                            <div className="col-span-3">Application No.</div>
                            <div className="col-span-3">Entrance Type</div>
                            <div className="col-span-2 text-right">Action</div>
                        </div>

                        {/* Queue Rows */}
                        <div className="divide-y divide-slate-200/70">
                            {drafts.map(draft => (
                                <div key={draft.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 md:py-3 md:items-center bg-white hover:bg-slate-50/80 transition-colors">
                                    {/* Mobile labels & stacked layout vs Desktop grid */}
                                    
                                    {/* Name */}
                                    <div className="md:col-span-4 flex flex-col md:block">
                                        <h3 className="font-medium text-slate-900 text-[15px] truncate">{draft.name}</h3>
                                    </div>
                                    
                                    {/* App No */}
                                    <div className="md:col-span-3 flex items-center justify-between md:block">
                                        <span className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider">Application No.</span>
                                        <p className="text-[14px] text-slate-600 font-mono tracking-tight">{draft.application_no || draft.id}</p>
                                    </div>
                                    
                                    {/* Entrance */}
                                    <div className="md:col-span-3 flex items-center justify-between md:block">
                                        <span className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider">Entrance Type</span>
                                        <p className="text-[14px] text-slate-600">{draft.entrance_exam}</p>
                                    </div>
                                    
                                    {/* Action */}
                                    <div className="md:col-span-2 flex justify-end mt-2 md:mt-0">
                                        <button 
                                            onClick={() => fetchDetail(draft.id)}
                                            disabled={fetchingDetail}
                                            className="w-full md:w-auto px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:text-blue-700 hover:border-blue-300 disabled:opacity-50 transition-all rounded-lg shadow-sm whitespace-nowrap cursor-pointer"
                                        >
                                            {selectedDraftId === draft.id && fetchingDetail ? 'Auditing...' : 'View & Verify'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
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
