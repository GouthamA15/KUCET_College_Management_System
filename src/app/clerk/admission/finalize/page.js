'use client';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';

const FinalizeAdmissionPage = () => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('CSE');
    const [rollNumbers, setRollNumbers] = useState({});
    const [finalizingId, setFinalizingId] = useState(null);

    const fetchVerifiedDrafts = useCallback(async () => {
        if (!selectedBranch) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/clerk/admission/drafts?branch=${selectedBranch}&status=PROCESSED`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch drafts.');
            setDrafts(data.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch]);

    useEffect(() => {
        fetchVerifiedDrafts();
    }, [fetchVerifiedDrafts]);

    const handleRollNumberChange = (draftId, value) => {
        setRollNumbers(prev => ({ ...prev, [draftId]: value.toUpperCase() }));
    };

    const handleFinalize = async (draftId) => {
        const rollNo = rollNumbers[draftId];
        if (!rollNo) return;
        
        setFinalizingId(draftId);
        const toastId = toast.loading('Finalizing admission...');
        try {
            const res = await fetch(`/api/clerk/admission/drafts/${draftId}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: rollNo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Finalization failed.');
            
            toast.success('Student Admitted Successfully!', { id: toastId });
            fetchVerifiedDrafts(); // Refresh list
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setFinalizingId(null);
        }
    };

    return (
        <main className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Finalize Student Admissions</h1>
                    <p className="text-sm text-gray-500 mt-1">Assign roll numbers to verified student application drafts.</p>
                </div>
                
                <div className="w-full md:w-64 bg-white p-1 rounded-lg shadow-sm border border-gray-200 flex">
                    <select 
                        value={selectedBranch} 
                        onChange={e => setSelectedBranch(e.target.value)} 
                        className="w-full p-2 bg-transparent text-sm font-bold text-gray-700 focus:outline-none"
                    >
                        {COLLEGE_CONFIG.branches.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
                        <p className="font-medium tracking-tight">Loading verified drafts for {selectedBranch}...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <div className="text-4xl mb-4">📂</div>
                        <p className="text-lg font-medium text-gray-900">No verified drafts for {selectedBranch}</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto">Verify new applications in the "Admission Requests" module to see them here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-[10px] uppercase tracking-widest border-b font-black">
                                <tr>
                                    <th className="p-4 w-12">#</th>
                                    <th className="p-4">Student Name</th>
                                    <th className="p-4">Father's Name</th>
                                    <th className="p-4">Exam Rank</th>
                                    <th className="p-4 w-64">Assign Roll Number</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {drafts.map((draft, index) => (
                                    <tr key={draft.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="p-4 text-gray-400 font-mono">{index + 1}</td>
                                        <td className="p-4 font-bold text-gray-900 uppercase">{draft.name}</td>
                                        <td className="p-4 text-gray-600 font-medium">{draft.father_name}</td>
                                        <td className="p-4">
                                            <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-bold shadow-sm">
                                                #{draft.exam_rank}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <input 
                                                type="text"
                                                placeholder="e.g. 23567T0901"
                                                value={rollNumbers[draft.id] || ''}
                                                onChange={e => handleRollNumberChange(draft.id, e.target.value)}
                                                className="block w-full px-3 py-2 border-2 border-gray-200 rounded-md text-sm font-bold tracking-widest focus:border-indigo-500 focus:outline-none transition-colors"
                                            />
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => handleFinalize(draft.id)} 
                                                disabled={!rollNumbers[draft.id] || finalizingId === draft.id} 
                                                className="bg-indigo-600 text-white px-6 py-2 rounded-md font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-md hover:shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95"
                                            >
                                                {finalizingId === draft.id ? 'Finalizing...' : 'Finalize'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
};

export default FinalizeAdmissionPage;
