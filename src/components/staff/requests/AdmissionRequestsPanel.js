'use client';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdmissionModal } from './AdmissionModal';
import AdmissionWorkspaceFilter from './AdmissionWorkspaceFilter';
import RealtimeListener from '@/components/RealtimeListener';
import { 
    getDefaultAdmissionWorkspace, 
    normalizeAdmissionWorkspace, 
    matchesAdmissionWorkspace 
} from '@/lib/admission-workspace';

const AdmissionRequestsPanel = () => {
    const searchParams = useSearchParams();
    const router = useRouter();

    const urlExam = searchParams.get('exam') || searchParams.get('entrance_exam') || searchParams.get('intakeExam');
    const urlBranch = searchParams.get('branch') || searchParams.get('targetBranch');
    const urlYear = searchParams.get('year') || searchParams.get('entryYear') || searchParams.get('admission_year');

    const activeWorkspace = useMemo(() => {
        const normalized = normalizeAdmissionWorkspace({
            intakeExam: urlExam,
            targetBranch: urlBranch,
            entryYear: urlYear
        });
        return normalized || getDefaultAdmissionWorkspace();
    }, [urlExam, urlBranch, urlYear]);

    const [workspace, setWorkspace] = useState(activeWorkspace);
    const [drafts, setDrafts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeQueueTab, setActiveQueueTab] = useState('DRAFT'); // 'DRAFT' | 'REJECTED' | 'PROCESSED'
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    // Rejection state
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Restoration state
    const [restorationMode, setRestorationMode] = useState(false);
    const [restorationReason, setRestorationReason] = useState('');

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditData] = useState({});

    // Filter drafts by search term (candidate name, app no, roll no, rank, email)
    const filteredDrafts = useMemo(() => {
        if (!searchTerm.trim()) return drafts;
        const term = searchTerm.toLowerCase().trim();
        return drafts.filter(draft => {
            const nameMatch = draft.name?.toLowerCase().includes(term);
            const appNoMatch = (draft.application_no || String(draft.id))?.toLowerCase().includes(term);
            const rollNoMatch = draft.roll_no?.toLowerCase().includes(term);
            const rankMatch = String(draft.exam_rank || '').includes(term);
            const emailMatch = draft.email?.toLowerCase().includes(term);
            return nameMatch || appNoMatch || rollNoMatch || rankMatch || emailMatch;
        });
    }, [drafts, searchTerm]);

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null :
               d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // Sync workspace from URL when search params change externally (e.g. browser back/forward)
    // Done inside useEffect to avoid setState-during-render cascades
    const prevUrlExam = useRef(urlExam);
    const prevUrlBranch = useRef(urlBranch);
    const prevUrlYear = useRef(urlYear);
    useEffect(() => {
        if (
            prevUrlExam.current !== urlExam ||
            prevUrlBranch.current !== urlBranch ||
            prevUrlYear.current !== urlYear
        ) {
            prevUrlExam.current = urlExam;
            prevUrlBranch.current = urlBranch;
            prevUrlYear.current = urlYear;
            setWorkspace(activeWorkspace);
        }
    }, [urlExam, urlBranch, urlYear, activeWorkspace]);

    const workspaceRef = useRef(workspace);
    const queueTabRef = useRef(activeQueueTab);
    useEffect(() => {
        workspaceRef.current = workspace;
        queueTabRef.current = activeQueueTab;
    }, [workspace, activeQueueTab]);

    const fetchWorkspaceDrafts = useCallback(async (targetWs = workspaceRef.current, status = queueTabRef.current) => {
        if (!targetWs?.targetBranch || !targetWs?.intakeExam) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                status: status || 'DRAFT',
                branch: targetWs.targetBranch,
                entrance_exam: targetWs.intakeExam,
                t: String(Date.now())
            });
            if (targetWs.entryYear) {
                queryParams.set('entry_year', String(targetWs.entryYear));
            }
            const res = await fetch(`/api/staff/admission/drafts?${queryParams.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch admission drafts.');
            const sortedData = [...(data.data || [])].sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return (b.id || 0) > (a.id || 0) ? 1 : -1;
            });
            setDrafts(sortedData);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkspaceDrafts(workspace, activeQueueTab);
    }, [workspace, activeQueueTab, fetchWorkspaceDrafts]);

    const handleWorkspaceChange = (newWs) => {
        setWorkspace(newWs);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'admissions');
        params.set('exam', newWs.intakeExam);
        params.set('branch', newWs.targetBranch);
        params.set('year', String(newWs.entryYear));
        router.replace(`/staff/admission/requests?${params.toString()}`);
    };

    const fetchDetail = useCallback(async (id) => {
        setFetchingDetail(true);
        setIsEditing(false);
        setRejectionMode(false);
        setRejectionReason('');
        setRestorationMode(false);
        setRestorationReason('');
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

    const handleReject = async () => {
        if (!detail) return;
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection.');
            return;
        }

        setProcessing(true);
        const toastId = toast.loading('Preserving audit trail and rejecting application...');
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

            toast.success('Application marked as REJECTED and preserved in audit queue.', { id: toastId });
            setDetail(null);
            setSelectedDraftId(null);
            setRejectionMode(false);
            setRejectionReason('');
            fetchWorkspaceDrafts(workspace, activeQueueTab);
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    const handleRestore = async () => {
        if (!detail) return;
        if (!restorationReason.trim()) {
            toast.error('Please specify a reason for restoring this application.');
            return;
        }

        setProcessing(true);
        const toastId = toast.loading('Restoring application to intake queue...');
        try {
            const res = await fetch(`/api/staff/admission/drafts/${detail.id}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_status: 'DRAFT',
                    restoration_reason: restorationReason
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Restoration failed.');

            toast.success('Application restored to pending queue!', { id: toastId });
            setDetail(null);
            setSelectedDraftId(null);
            setRestorationMode(false);
            setRestorationReason('');
            fetchWorkspaceDrafts(workspace, activeQueueTab);
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
            setDetail(null);
            setSelectedDraftId(null);
            setIsEditing(false);
            setEditData({});
            fetchWorkspaceDrafts(workspace, activeQueueTab);
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
            setDetail({ ...editForm });
            setIsEditing(false);
            fetchWorkspaceDrafts(workspace, activeQueueTab);
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

    // Realtime integration: Workspace-aware event dispatcher
    const handleRealtimeUpdate = useCallback((data) => {
        if (!data?.type) return;
        const { type, payload } = data;

        if ([
            'ADMISSION_DRAFT_CREATED', 'ADMISSION_DRAFT_UPDATED', 'ADMISSION_DRAFT_FINALIZED', 'ADMISSION_DRAFT_DELETED',
            'admission:created', 'admission:updated', 'admission:finalized', 'admission:deleted',
            'admission:draft:created', 'admission:draft:updated', 'admission:draft:finalized', 'admission:draft:deleted'
        ].includes(type)) {
            // Workspace isolation: check if event payload matches current active workspace
            if (!payload || matchesAdmissionWorkspace(payload, workspaceRef.current)) {
                fetchWorkspaceDrafts(workspaceRef.current, queueTabRef.current);
            }
        }
    }, [fetchWorkspaceDrafts]);

    return (
        <div className="space-y-6">
            <RealtimeListener onUpdate={handleRealtimeUpdate} />

            {/* Canonical Admission Workspace Filter */}
            <AdmissionWorkspaceFilter
                workspace={workspace}
                onChange={handleWorkspaceChange}
                onRefresh={() => fetchWorkspaceDrafts(workspace, activeQueueTab)}
                isLoading={loading}
            />

            {/* Queue Sub-Tabs & In-Queue Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveQueueTab('DRAFT')}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                            activeQueueTab === 'DRAFT'
                                ? 'bg-[#0b3578] text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Pending Applications
                    </button>
                    <button
                        onClick={() => setActiveQueueTab('REJECTED')}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                            activeQueueTab === 'REJECTED'
                                ? 'bg-rose-700 text-white shadow-sm'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                    >
                        <span>🚫</span> Rejected Applications
                    </button>
                    <button
                        onClick={() => setActiveQueueTab('PROCESSED')}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                            activeQueueTab === 'PROCESSED'
                                ? 'bg-emerald-700 text-white shadow-sm'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                    >
                        Verified Candidates
                    </button>
                </div>

                {/* Instant In-Queue Search Bar */}
                <div className="relative flex-1 sm:max-w-xs">
                    <input 
                        type="text" 
                        placeholder="Search name, app no, rank..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] shadow-sm"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 font-bold"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center px-1 mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {activeQueueTab === 'REJECTED' ? 'Rejected Applications Archive' : activeQueueTab === 'PROCESSED' ? 'Verified Candidates Queue' : 'Admission Intake Queue'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeQueueTab === 'REJECTED' ? 'Auditable repository of rejected applications with instant restoration support for' : 'Review candidates for'}{' '}
                    <span className="font-semibold text-[#0b3578]">{workspace.intakeExam}</span> •{' '}
                    <span className="font-semibold text-[#0b3578]">{workspace.targetBranch}</span> •{' '}
                    <span className="font-semibold text-[#0b3578]">{workspace.entryYear}</span>.
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                    Showing <span className="font-bold text-slate-800">{filteredDrafts.length}</span> of {drafts.length} record{drafts.length === 1 ? '' : 's'}
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-sm font-medium">Accessing {workspace.intakeExam} {activeQueueTab} Records...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-4xl block mb-3 opacity-30">
                            {activeQueueTab === 'REJECTED' ? '🛡️' : '📂'}
                        </span>
                        <p className="text-sm font-medium text-gray-700">
                            No {activeQueueTab.toLowerCase()} records found for {workspace.intakeExam} • {workspace.targetBranch} ({workspace.entryYear}).
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {activeQueueTab === 'REJECTED' 
                                ? 'No applications have been rejected in this workspace.'
                                : 'When candidates submit applications for this branch and exam, they will appear here.'}
                        </p>
                    </div>
                ) : filteredDrafts.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-3xl block mb-2 opacity-40">🔍</span>
                        <p className="text-sm font-medium text-gray-700">No applications match &quot;{searchTerm}&quot;</p>
                        <p className="text-xs text-gray-400 mt-1">Try searching with a different candidate name, application number, or rank.</p>
                        <button
                            onClick={() => setSearchTerm('')}
                            className="mt-3 px-3.5 py-1.5 bg-white border border-slate-300 text-xs font-semibold text-[#0b3578] rounded-md hover:bg-slate-50 cursor-pointer shadow-sm"
                        >
                            Clear Search Filter
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Desktop Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 bg-white/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-4">Student Name</div>
                            <div className="col-span-2">Application No.</div>
                            <div className="col-span-2">Entrance Type</div>
                            <div className="col-span-2">{activeQueueTab === 'REJECTED' ? 'Rejection Reason' : 'Status'}</div>
                            <div className="col-span-2 text-right">Action</div>
                        </div>

                        {/* Queue Rows */}
                        <div className="divide-y divide-slate-200/70">
                            {filteredDrafts.map(draft => (
                                <div key={draft.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 md:py-3 md:items-center bg-white hover:bg-slate-50/80 transition-colors">
                                    {/* Name & Rank */}
                                    <div className="md:col-span-4 flex flex-col md:block">
                                        <h3 className="font-medium text-slate-900 text-[15px] truncate">{draft.name}</h3>
                                        <span className="text-[11px] text-gray-400 font-medium">
                                            Rank: {draft.exam_rank || 'N/A'} • {draft.branch}
                                        </span>
                                    </div>
                                    
                                    {/* App No & Date */}
                                    <div className="md:col-span-2 flex items-center justify-between md:block">
                                        <span className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider">App No. / Date</span>
                                        <div>
                                            <p className="text-[14px] text-slate-700 font-mono font-medium tracking-tight">{draft.application_no || draft.id}</p>
                                            {formatDate(draft.created_at) && (
                                                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(draft.created_at)}</p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Entrance */}
                                    <div className="md:col-span-2 flex items-center justify-between md:block">
                                        <span className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider">Entrance Type</span>
                                        <p className="text-[14px] text-slate-600">{draft.entrance_exam}</p>
                                    </div>

                                    {/* Status or Rejection Rationale */}
                                    <div className="md:col-span-2 flex items-center justify-between md:block">
                                        <span className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider">
                                            {activeQueueTab === 'REJECTED' ? 'Reason' : 'Status'}
                                        </span>
                                        {activeQueueTab === 'REJECTED' ? (
                                            <p className="text-xs text-rose-700 italic truncate max-w-[200px]" title={draft.rejection_reason}>
                                                {draft.rejection_reason || 'Incomplete details'}
                                            </p>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                                draft.status === 'PROCESSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {draft.status || 'DRAFT'}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Action */}
                                    <div className="md:col-span-2 flex justify-end gap-2 mt-2 md:mt-0">
                                        <button 
                                            onClick={() => fetchDetail(draft.id)}
                                            disabled={fetchingDetail}
                                            className="w-full md:w-auto px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:text-blue-700 hover:border-blue-300 disabled:opacity-50 transition-all rounded-lg shadow-sm whitespace-nowrap cursor-pointer"
                                        >
                                            {selectedDraftId === draft.id && fetchingDetail ? 'Auditing...' : (activeQueueTab === 'REJECTED' ? 'Inspect / Restore' : 'View & Verify')}
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
                    onRestore={handleRestore}
                    processing={processing}
                    rejectionMode={rejectionMode}
                    setRejectionMode={setRejectionMode}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    restorationMode={restorationMode}
                    setRestorationMode={setRestorationMode}
                    restorationReason={restorationReason}
                    setRestorationReason={setRestorationReason}
                />
            )}
        </div>
    );
};

export default AdmissionRequestsPanel;
