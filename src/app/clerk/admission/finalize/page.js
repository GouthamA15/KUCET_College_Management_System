"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import toast from "react-hot-toast";
import { useRouter } from 'next/navigation';
import { COLLEGE_CONFIG } from "@/lib/college-config";
import { validateRollNo } from "@/lib/rollNumber";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function FinalizeAdmissionContent() {
    const router = useRouter();
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('CSE');
    const [selectedExam, setSelectedExam] = useState('EAMCET');
    const [rollNumbers, setRollNumbers] = useState({});
    const [finalizingId, setFinalizingId] = useState(null);
    const [generating, setGenerating] = useState(false);

    // Derived validation for a specific roll number
    const getRollValidation = (rollNo, draft) => {
        if (!rollNo) return { isValid: false };
        const result = validateRollNo(rollNo);
        if (!result.isValid) return { isValid: false, error: 'Invalid Format' };
        
        // Check if branch matches
        if (result.branch !== draft.branch) {
            return { isValid: false, error: `Branch Mismatch (Got ${result.branch})` };
        }

        // Check if admission type matches exam
        const expectedType = draft.entrance_exam === 'ECET' ? 'Lateral' : 'Regular';
        if (result.admissionType !== expectedType) {
            return { isValid: false, error: `${draft.entrance_exam} must be ${expectedType}` };
        }

        return { isValid: true };
    };

    const fetchVerifiedDrafts = useCallback(async () => {
        if (!selectedBranch || !selectedExam) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/clerk/admission/drafts?branch=${selectedBranch}&entrance_exam=${selectedExam}&status=PROCESSED`);
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

    const handleGenerateRollNumbers = async () => {
        if (drafts.length === 0) return;

        const first = drafts[0];
        const startYearRaw = String(first.admission_year || '').split('-')[0];
        let joiningYear = parseInt(startYearRaw, 10);
        
        // Lateral Entry (ECET) students join one year after the batch starts (e.g. Batch 2024 -> Joins 2025)
        if (selectedExam === 'ECET') {
            joiningYear += 1;
        }

        if (!Number.isInteger(joiningYear)) {
            toast.error('Could not determine joining year from admission batch');
            return;
        }

        setGenerating(true);
        const toastId = toast.loading('Generating roll numbers...');
        try {
            const res = await fetch('/api/admissions/generate-roll-number', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch: selectedBranch,
                    examType: selectedExam,
                    joiningYear,
                    count: drafts.length,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate roll numbers.');

            const list = data.rollNumbers || (data.rollNumber ? [data.rollNumber] : []);
            if (list.length !== drafts.length) {
                throw new Error('Roll generation returned unexpected count');
            }

            const nextMap = {};
            drafts.forEach((d, idx) => {
                nextMap[d.id] = String(list[idx]).toUpperCase();
            });
            setRollNumbers(nextMap);
            toast.success('Roll numbers generated.', { id: toastId });
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 gap-5 pb-4">
                <div className="space-y-1">
                    <p className="text-[#0b3578] text-[10px] font-bold uppercase tracking-[0.25em] opacity-90">Registry Command</p>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase">Finalize Admissions</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                        Institutional Roll Number Assignment
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/clerk/admission/dashboard')}
                        className="px-6 py-2 border-2 border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all shadow-sm"
                    >
                        ← Return to Dashboard
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 border border-slate-200 rounded-sm shadow-sm">
                <div>
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Workspace Filter</h2>
                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-1 tracking-wider">Select target branch and intake examination</p>
                </div>
                
                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 sm:w-40">
                      <label className="block text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Intake Exam</label>
                      <select 
                          value={selectedExam} 
                          onChange={e => setSelectedExam(e.target.value)} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-xs font-black text-[#0b3578] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-sm transition-all"
                      >
                          <option value="EAMCET">EAMCET</option>
                          <option value="ECET">ECET</option>
                      </select>
                    </div>
                    <div className="flex-1 sm:w-60">
                      <label className="block text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Target Branch</label>
                      <select 
                          value={selectedBranch} 
                          onChange={e => setSelectedBranch(e.target.value)} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-xs font-black text-[#0b3578] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-sm transition-all"
                      >
                          {COLLEGE_CONFIG.branches.map(b => <option key={b.code} value={b.name}>{b.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 sm:w-56 sm:self-end">
                        <button
                            type="button"
                            onClick={handleGenerateRollNumbers}
                            disabled={loading || generating || drafts.length === 0}
                            className="w-full px-6 py-2 border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                        >
                            {generating ? 'Generating...' : 'Generate Roll Numbers'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">Accessing {selectedExam} Queue...</p>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="text-center py-24 text-slate-400">
                      <span className="text-5xl block mb-6 opacity-20">📂</span>
                      <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">No {selectedExam} drafts found</h3>
                      <p className="text-[10px] font-medium text-slate-500 mt-2 uppercase tracking-tighter max-w-xs mx-auto">Verify new applications in the Requests Center to populate this registry.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-5 w-16 border-r border-slate-200">ID</th>
                                    <th className="px-6 py-5 border-r border-slate-200">Applicant Identity</th>
                                    <th className="px-6 py-5 border-r border-slate-200">Guardian Record</th>
                                    <th className="px-6 py-5 border-r border-slate-200">Merit Rank</th>
                                    <th className="px-6 py-5 w-72 border-r border-slate-200">Institutional Roll Number</th>
                                    <th className="px-6 py-5 text-right uppercase tracking-widest">Operational Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {drafts.map((draft, index) => {
                                    const validation = getRollValidation(rollNumbers[draft.id], draft);
                                    const hasValue = !!rollNumbers[draft.id];

                                    return (
                                        <tr key={draft.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-slate-400 font-bold border-r border-slate-100">{index + 1}</td>
                                            <td className="px-6 py-4 font-black text-slate-800 uppercase border-r border-slate-100 tracking-tight">{draft.name}</td>
                                            <td className="px-6 py-4 text-slate-500 font-bold border-r border-slate-100 uppercase text-[10px] tracking-tight">{draft.father_name}</td>
                                            <td className="px-6 py-4 border-r border-slate-100">
                                                <span className="bg-blue-50 text-[#0b3578] border border-blue-100 px-3 py-1 rounded-sm text-[10px] font-black shadow-sm">
                                                    RANK {draft.exam_rank}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 border-r border-slate-100">
                                                <div className="space-y-1.5">
                                                    <input 
                                                        type="text"
                                                        placeholder={draft.entrance_exam === 'ECET' ? "e.g. 235670901L" : "e.g. 23567T0901"}
                                                        value={rollNumbers[draft.id] || ''}
                                                        onChange={e => handleRollNumberChange(draft.id, e.target.value)}
                                                        className={`block w-full px-3 py-2 border-2 text-xs font-black tracking-widest focus:outline-none transition-all rounded-sm uppercase ${
                                                            !hasValue ? 'border-slate-100 bg-slate-50' :
                                                            validation.isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                                                        }`}
                                                    />
                                                    {hasValue && !validation.isValid && (
                                                        <div className="text-[9px] text-rose-600 font-black uppercase tracking-tight px-1 flex items-center gap-1">
                                                            ⚠️ {validation.error}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => handleFinalize(draft.id)} 
                                                    disabled={!validation.isValid || finalizingId === draft.id} 
                                                    className="w-full bg-[#0b3578] text-white px-5 py-2 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-100 disabled:opacity-50 transition-all active:scale-95"
                                                >
                                                    {finalizingId === draft.id ? 'Finalizing...' : 'Finalize'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
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
