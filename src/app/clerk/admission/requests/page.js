'use client';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';

const AdmissionRequestsPage = () => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [processing, setProcessing] = useState(false);
    
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

    const handleVerify = async () => {
        if (!detail) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/clerk/admission/drafts/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PROCESSED' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed.');
            toast.success('Application Verified Successfully!');
            setDetail(null);
            setSelectedDraftId(null);
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

    const EditableField = ({ label, name, type = "text", fullWidth = false, options = null }) => {
        if (!isEditing) {
            let val = detail[name];
            if (type === 'date' && val) val = new Date(val).toLocaleDateString();
            return (
                <div className={`${fullWidth ? 'col-span-2' : ''} border-b border-gray-100 py-2`}>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-tight">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{val || 'N/A'}</span>
                </div>
            );
        }

        return (
            <div className={`${fullWidth ? 'col-span-2' : ''} space-y-1`}>
                <label className="text-[10px] uppercase font-black text-indigo-400">{label}</label>
                {options ? (
                    <select 
                        value={editForm[name] || ''} 
                        onChange={e => setEditData({...editForm, [name]: e.target.value})}
                        className="w-full p-1 border rounded text-sm bg-indigo-50/30 border-indigo-100"
                    >
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : type === 'textarea' ? (
                    <textarea 
                        value={editForm[name] || ''} 
                        onChange={e => setEditData({...editForm, [name]: e.target.value})}
                        rows={2}
                        className="w-full p-1 border rounded text-sm bg-indigo-50/30 border-indigo-100"
                    />
                ) : (
                    <input 
                        type={type} 
                        value={editForm[name] || ''} 
                        onChange={e => setEditData({...editForm, [name]: e.target.value})}
                        className="w-full p-1 border rounded text-sm bg-indigo-50/30 border-indigo-100 focus:ring-1 focus:ring-indigo-500"
                    />
                )}
            </div>
        );
    };

    return (
        <main className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Student Admission Requests</h1>
                <button onClick={fetchDrafts} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 shadow-sm transition-all">
                    <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Refresh
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
                        <p>Loading applications...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 font-medium">No pending requests found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b">
                                <tr>
                                    <th className="p-4 font-semibold">Student Name</th>
                                    <th className="p-4 font-semibold">Father's Name</th>
                                    <th className="p-4 font-semibold">Exam / Rank</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {drafts.map(draft => (
                                    <tr key={draft.id} className="hover:bg-gray-50 group">
                                        <td className="p-4 font-semibold text-gray-900">{draft.name}</td>
                                        <td className="p-4 text-gray-600">{draft.father_name}</td>
                                        <td className="p-4">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold mr-2">{draft.entrance_exam}</span>
                                            <span className="text-gray-500">#{draft.exam_rank}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => fetchDetail(draft.id)}
                                                disabled={fetchingDetail}
                                                className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-md font-bold text-xs transition-all shadow-sm disabled:opacity-50"
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col scale-in-center">
                        {/* Modal Header */}
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-700 text-white">
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-tight">{detail.name}</h2>
                                <p className="text-xs text-indigo-200 font-medium">B.Tech Admission Request - {detail.admission_year}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => { setIsEditing(!isEditing); if(!isEditing) setEditData(detail); }}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border-2 ${isEditing ? 'bg-white text-indigo-700 border-white' : 'bg-transparent text-white border-indigo-400 hover:border-white'}`}
                                >
                                    {isEditing ? 'Cancel Edit' : 'Edit Info'}
                                </button>
                                <button onClick={() => setDetail(null)} className="text-white hover:text-indigo-200 text-2xl font-bold transition-colors">&times;</button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                {/* Media Section */}
                                <div className="md:col-span-1 space-y-6">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Photograph</p>
                                        <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden relative shadow-inner">
                                            {detail.pfp ? <img src={detail.pfp} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-bold uppercase text-[10px]">No Photo</div>}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Signature</p>
                                        <div className="w-full h-20 bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden relative shadow-inner">
                                            {detail.signature ? <img src={detail.signature} className="w-full h-full object-contain p-2" /> : <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-bold uppercase text-[10px]">No Signature</div>}
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 font-bold uppercase leading-tight">
                                            Note: Images cannot be edited here. If images are wrong, reject the application.
                                        </div>
                                    )}
                                </div>

                                {/* Data Section */}
                                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <h3 className="col-span-2 text-xs font-black text-indigo-600 uppercase tracking-widest border-b-2 border-indigo-100 pb-1 mb-2">1. Personal Details</h3>
                                    <EditableField label="Full Name" name="name" />
                                    <EditableField label="Gender" name="gender" options={['Male', 'Female', 'Other']} />
                                    <EditableField label="Father's Name" name="father_name" />
                                    <EditableField label="Mother's Name" name="mother_name" />
                                    <EditableField label="Date of Birth" name="dob" type="date" />
                                    <EditableField label="Nationality" name="nationality" />
                                    <EditableField label="Religion" name="religion" />
                                    <EditableField label="Mother Tongue" name="mother_tongue" />
                                    <EditableField label="Blood Group" name="blood_group" />
                                    <EditableField label="Aadhaar Number" name="aadhaar_no" />

                                    <h3 className="col-span-2 text-xs font-black text-indigo-600 uppercase tracking-widest border-b-2 border-indigo-100 pb-1 mb-2 mt-6">2. Academic & Category</h3>
                                    <EditableField label="Entrance Exam" name="entrance_exam" options={['EAMCET', 'ECET']} />
                                    <EditableField label="Entrance Rank" name="exam_rank" type="number" />
                                    <EditableField label="SSC / 10th Marks" name="ssc_marks" />
                                    <EditableField label="Inter / Diploma Marks" name="inter_diploma_marks" />
                                    <EditableField label="Branch" name="branch" options={COLLEGE_CONFIG.branches.map(b => b.name)} />
                                    <EditableField label="Category" name="category" options={COLLEGE_CONFIG.categories} />
                                    <EditableField label="Sub Caste" name="sub_caste" />
                                    <EditableField label="Seat Allotted Category" name="seat_allotted_category" />
                                    <EditableField label="Area Status" name="area_status" options={['Local', 'Non Local']} />
                                    <EditableField label="Fee Reimbursement" name="fee_reimbursement" options={['YES', 'NO', 'GOV']} />

                                    <h3 className="col-span-2 text-xs font-black text-indigo-600 uppercase tracking-widest border-b-2 border-indigo-100 pb-1 mb-2 mt-6">3. Contact & Identification</h3>
                                    <EditableField label="Student Mobile" name="student_mobile" />
                                    <EditableField label="Guardian Mobile" name="guardian_mobile" />
                                    <EditableField label="Email ID" name="email" fullWidth />
                                    <EditableField label="Identification Mark 1" name="identification_mark_1" type="textarea" fullWidth />
                                    <EditableField label="Identification Mark 2" name="identification_mark_2" type="textarea" fullWidth />
                                    <EditableField label="Permanent Address" name="permanent_address" type="textarea" fullWidth />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
                            <button onClick={() => setDetail(null)} className="px-6 py-2 border border-gray-300 rounded-md font-bold text-gray-600 hover:bg-white transition-all">Close</button>
                            
                            {isEditing ? (
                                <button 
                                    onClick={handleSaveEdit} 
                                    disabled={processing}
                                    className="px-8 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 shadow-lg transition-all disabled:opacity-50"
                                >
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </button>
                            ) : (
                                <button 
                                    onClick={handleVerify} 
                                    disabled={processing}
                                    className="px-8 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : 'Verify & Ready for Finalization'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default AdmissionRequestsPage;
