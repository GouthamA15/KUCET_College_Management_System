'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Info, 
  CreditCard, 
  History, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  User,
  Calendar,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Edit2,
  Save
} from 'lucide-react';
import { getYearlyTotalFee } from '@/lib/financial-utils';

export default function AddEditRecordInstitutionalModal({
  open,
  year,
  student,
  summary,
  formState,
  setFormState,
  saving,
  onProceedingSave,
  onPaymentSave,
  onFinalUpdate,
  onClose,
  onDeletePayment,
  onDeleteScholarship,
  onSelectProceeding,
  onCancelEdit,
  toDmy,
}) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!open) return null;

  // Derived values
  const totalFee = getYearlyTotalFee(student?.course);
  const proceedings = Array.isArray(summary?.scholarship_proceedings) ? summary.scholarship_proceedings : [];
  const payments = Array.isArray(summary?.student_payments) ? summary.student_payments : [];

  const totalSanctioned = proceedings.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalReleased = proceedings.reduce((sum, p) => sum + (Number(p.released_amount) || 0), 0);
  const totalStudentPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  const GOVT_CAP = 35000;
  const eligibleAmount = student?.fee_reimbursement === 'YES' ? GOVT_CAP : 0;
  
  // Validation for UI
  const currentEntryAmt = Number(formState.schAmount) || 0;
  const currentRelAmt = Number(formState.releasedAmount) || 0;
  
  const totalExcludingCurrent = proceedings
    .filter(p => !formState.selectedProceeding || p.id !== formState.selectedProceeding.id)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const relExcludingCurrent = proceedings
    .filter(p => !formState.selectedProceeding || p.id !== formState.selectedProceeding.id)
    .reduce((sum, p) => sum + (Number(p.released_amount) || 0), 0);

  const isOverflow = (totalExcludingCurrent + currentEntryAmt) > GOVT_CAP;
  const isRelOverflow = (relExcludingCurrent + currentRelAmt) > GOVT_CAP;

  const remainingEligible = Math.max(0, GOVT_CAP - totalSanctioned);
  const balanceToRelease = Math.max(0, totalSanctioned - totalReleased);
  const pendingFromStudent = Math.max(0, totalFee - (totalSanctioned + totalStudentPaid));

  const setField = (k, v) => setFormState?.(k, v);

  // Status computation
  let status = 'Pending';
  let statusColor = 'bg-slate-100 text-slate-600';
  if (totalReleased >= totalFee && totalFee > 0) {
    status = 'Fully Released';
    statusColor = 'bg-emerald-100 text-emerald-700';
  } else if (totalReleased > 0) {
    status = 'Partially Released';
    statusColor = 'bg-blue-100 text-blue-700';
  } else if (totalSanctioned > 0) {
    status = 'Sanctioned';
    statusColor = 'bg-indigo-100 text-indigo-700';
  }

  // Application lock logic
  const hasExistingApp = !!(summary?.application_no && String(summary.application_no).trim() !== '');
  const isAppLocked = hasExistingApp && !formState.appEditing;

  // Debug wrappers
  const wrapSave = (fn, label) => async () => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Scholarship Registry] Triggering ${label}...`);
        console.log(`[Scholarship Registry] Current Form State:`, formState);
    }
    try {
        await fn();
        if (process.env.NODE_ENV === 'development') console.log(`[Scholarship Registry] ${label} SUCCESS`);
    } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error(`[Scholarship Registry] ${label} ERROR:`, err);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
      {!isDesktop ? (
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
            <Info size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Desktop Access Required</h3>
          <p className="text-slate-600 leading-relaxed">
            Scholarship financial processing is available only on desktop devices to ensure accuracy and compliance.
          </p>
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 w-full max-w-[1200px] h-[90vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
          {/* 1. STICKY MODAL HEADER */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Scholarship Financial Processing
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest rounded border border-slate-200">
                    Registry Command
                  </span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{year}</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-900">{student?.roll_no}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-slate-800">{student?.name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-indigo-600">{student?.course}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusColor}`}>
                {status}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth custom-scrollbar">
            
            {/* 3. FINANCIAL STATUS SUMMARY */}
            <section className="grid grid-cols-4 gap-6">
              {[
                { label: 'Total Sanctioned', value: totalSanctioned, icon: FileText, color: 'indigo' },
                { label: 'Total Released', value: totalReleased, icon: CheckCircle2, color: 'emerald' },
                { label: 'Pending Release', value: balanceToRelease, icon: Clock, color: 'blue' },
                { label: 'Remaining Eligible', value: remainingEligible, icon: TrendingUp, color: 'slate' }
              ].map((card, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>
                      <card.icon size={18} />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                  <h4 className="text-2xl font-black text-slate-800 mt-1">₹{card.value.toLocaleString()}</h4>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-12 gap-8">
              {/* Left Column - Financial Operations */}
              <div className="col-span-7 space-y-8">
                
                {/* 4. SCHOLARSHIP DETAILS SECTION */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
                   <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={14} className="text-indigo-500" />
                      Scholarship Details
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          Application Number
                          {isAppLocked && (
                            <button 
                              onClick={() => setField('appEditing', true)}
                              className="text-indigo-600 hover:text-indigo-800 lowercase font-normal"
                            >
                              (unlock)
                            </button>
                          )}
                        </label>
                        <input 
                          type="text"
                          value={formState.schAppNo || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                            setField('schAppNo', val);
                          }}
                          disabled={isAppLocked}
                          placeholder="Enter 6-15 digit Application No"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {formState.appEditing && (
                           <div className="flex items-center gap-2 text-[10px] text-amber-600 font-medium">
                            <AlertCircle size={10} />
                            Application numbers propagate across all years. Edit with caution.
                           </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compliance Registry</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center h-[46px] gap-3 bg-slate-50 px-3 rounded-lg border border-slate-100">
                                <input 
                                    type="checkbox" 
                                    id="hardcopy"
                                    checked={!!formState.hardcopySubmitted}
                                    onChange={(e) => setField('hardcopySubmitted', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                />
                                <label htmlFor="hardcopy" className="text-[10px] font-bold text-slate-700 uppercase cursor-pointer">Hardcopy</label>
                            </div>
                            <div className="flex items-center h-[46px] gap-3 bg-slate-50 px-3 rounded-lg border border-slate-100">
                                <input 
                                    type="checkbox" 
                                    id="thumb"
                                    checked={!!formState.thumbUpdateAvailable}
                                    onChange={(e) => setField('thumbUpdateAvailable', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                />
                                <label htmlFor="thumb" className="text-[10px] font-bold text-slate-700 uppercase cursor-pointer">Thumb Update Available</label>
                            </div>
                        </div>
                        {formState.thumbUpdateAvailable && (
                            <div className="mt-3 space-y-1.5 animate-fadeIn">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Thumb Verification Status</label>
                                <select 
                                    value={formState.thumbStatus || 'PENDING'}
                                    onChange={(e) => setField('thumbStatus', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
                                >
                                    <option value="PENDING">PENDING</option>
                                    <option value="COMPLETE">COMPLETE</option>
                                </select>
                            </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 5. NEW/EDIT PROCEEDING ENTRY SECTION */}
                <section className={`rounded-xl border shadow-md transition-all overflow-hidden ${formState.selectedProceeding ? 'border-amber-200 shadow-amber-500/5' : 'border-indigo-100 shadow-indigo-500/5'}`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${formState.selectedProceeding ? 'bg-amber-600 border-amber-700' : 'bg-indigo-600 border-indigo-700'}`}>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      {formState.selectedProceeding ? <Edit2 size={14} /> : <PlusCircle size={14} />}
                      {formState.selectedProceeding ? 'Update Existing Proceeding' : 'Register New Proceeding'}
                    </h3>
                    {formState.selectedProceeding && (
                       <button onClick={onCancelEdit} className="text-[9px] font-bold text-amber-100 uppercase tracking-widest bg-amber-700/50 px-2 py-0.5 rounded">Cancel Edit</button>
                    )}
                  </div>
                  <div className={`p-6 space-y-6 ${formState.selectedProceeding ? 'bg-amber-50/30' : 'bg-indigo-50/30'}`}>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proceeding ID</label>
                        <input 
                          type="text"
                          value={formState.schProceedingNo || ''}
                          onChange={(e) => setField('schProceedingNo', e.target.value)}
                          placeholder="e.g. 152/S1/2023"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sanctioned Amount</label>
                        <div className="relative">
                          <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="number"
                            value={formState.schAmount || ''}
                            onChange={(e) => setField('schAmount', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sanction Date</label>
                        <input 
                          type="date"
                          value={formState.schSanctionDate || ''}
                          onChange={(e) => setField('schSanctionDate', e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Released Amount</label>
                        <div className="relative">
                          <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="number"
                            value={formState.releasedAmount || ''}
                            onChange={(e) => setField('releasedAmount', e.target.value)}
                            placeholder="Actually disbursed"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Released Date</label>
                        <input 
                          type="date"
                          value={formState.releasedDate || ''}
                          onChange={(e) => setField('releasedDate', e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    
                    {/* Inline Validation Warnings */}
                    {(Number(formState.schAmount) > remainingEligible && Number(formState.schAmount) > 0) && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
                        <AlertCircle size={16} className="text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-tighter">Budget Warning</p>
                          <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Total sanction exceeds remaining eligible cap. Check policy.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button 
                        onClick={wrapSave(onProceedingSave, 'PROCEEDING')}
                        disabled={saving || !formState.schAppNo || !formState.schProceedingNo}
                        className={`flex items-center gap-2 px-6 py-3 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none ${formState.selectedProceeding ? 'bg-amber-600 shadow-amber-500/30 hover:shadow-amber-500/40' : 'bg-indigo-600 shadow-indigo-500/30 hover:shadow-indigo-500/40'} hover:-translate-y-0.5 active:translate-y-0`}
                      >
                        {saving ? <Clock size={14} className="animate-spin" /> : (formState.selectedProceeding ? <Save size={14} /> : <PlusCircle size={14} />)}
                        {saving ? 'Processing...' : (formState.selectedProceeding ? 'Update Registry Entry' : 'Register Proceeding Entry')}
                      </button>
                    </div>
                  </div>
                </section>

                {/* 6. EXISTING PROCEEDINGS TABLE */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <History size={14} className="text-slate-400" />
                      Scholarship Proceedings
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{proceedings.length} records</span>
                  </div>
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-200">
                        <tr className="bg-white">
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proceeding</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sanctioned</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sanction Date</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Released</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {proceedings.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-4 py-12 text-center text-slate-400 italic text-sm">No proceedings recorded for this year.</td>
                          </tr>
                        ) : (
                          proceedings.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-4 py-4">
                                <p className="text-sm font-bold text-slate-700">{p.proceeding_no}</p>
                              </td>
                              <td className="px-4 py-4 text-sm font-black text-slate-700">₹{Number(p.amount).toLocaleString()}</td>
                              <td className="px-4 py-4 text-center text-[10px] font-bold text-slate-500 uppercase">{toDmy(p.date)}</td>
                              <td className="px-4 py-4">
                                {p.released_amount ? (
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-black text-emerald-600">₹{Number(p.released_amount).toLocaleString()}</p>
                                    <p className="text-[9px] text-emerald-500 font-bold uppercase">{toDmy(p.released_date)}</p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-300 uppercase italic">Pending</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => onSelectProceeding?.(p)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => onDeleteScholarship?.(p.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {/* Right Column - Student Operations */}
              <div className="col-span-5 space-y-8">
                
                {/* 7. STUDENT PAYMENT SECTION */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard size={14} className="text-amber-500" />
                      Student Fee Payments
                    </h3>
                  </div>
                  <div className="p-6 bg-amber-50/10 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount Paid</label>
                        <input 
                          type="number"
                          value={formState.payAmount || ''}
                          onChange={(e) => setField('payAmount', e.target.value)}
                          placeholder="₹0.00"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Date</label>
                        <input 
                          type="date"
                          value={formState.payDate || ''}
                          onChange={(e) => setField('payDate', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
                        <select 
                          value={formState.payMode || 'UPI'}
                          onChange={(e) => setField('payMode', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-white"
                        >
                          <option value="CASH">CASH</option>
                          <option value="UPI">UPI / QR</option>
                          <option value="BANK_TRANSFER">BANK TRANSFER</option>
                          <option value="DD">DEMAND DRAFT (DD)</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank Name</label>
                        <input 
                          type="text"
                          value={formState.bankName || ''}
                          onChange={(e) => setField('bankName', e.target.value)}
                          placeholder="Bank name"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reference (UTR/Ref No)</label>
                        <input 
                          type="text"
                          value={formState.payRef || ''}
                          onChange={(e) => setField('payRef', e.target.value)}
                          placeholder="e.g. DU15263748"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={wrapSave(onPaymentSave, 'PAYMENT')}
                      disabled={saving || !formState.payAmount || !formState.payRef}
                      className="w-full py-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm hover:bg-amber-600 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Processing...' : 'Register Student Payment'}
                    </button>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto border-t border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount / Date</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Mode / Ref</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments.length === 0 ? (
                           <tr>
                            <td colSpan="3" className="px-4 py-8 text-center text-slate-400 text-xs italic">No student payments recorded.</td>
                          </tr>
                        ) : (
                          payments.slice().reverse().map(p => (
                            <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-xs font-black text-slate-700">₹{Number(p.amount).toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{toDmy(p.date)}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{p.payment_mode || 'UPI'}</p>
                                <p className="text-[10px] font-bold text-slate-400 font-mono truncate max-w-[120px]">{p.transaction_ref}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button 
                                  onClick={() => onDeletePayment?.(p.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 8. SCHOLARSHIP RELEASE STATUS */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-500" />
                      Scholarship Release Status
                    </h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                       <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Disbursement Lifecycle</span>
                       </div>
                       <div className="space-y-2">
                         <div className="flex justify-between items-center text-[10px] font-bold">
                           <span className="text-emerald-600 uppercase">Released</span>
                           <span className="text-emerald-800 font-black">₹{totalReleased.toLocaleString()} / ₹{totalSanctioned.toLocaleString()}</span>
                         </div>
                         <div className="w-full h-1.5 bg-emerald-200/50 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-emerald-500 transition-all duration-500"
                             style={{ width: `${totalSanctioned > 0 ? (totalReleased / totalSanctioned) * 100 : 0}%` }}
                           ></div>
                         </div>
                       </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </main>

          {/* 10. STICKY FOOTER ACTIONS */}
          <footer className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between sticky bottom-0 z-20">
             <div className="flex items-center gap-4 text-xs">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Value Impact</span>
                    <span className="text-sm font-black text-slate-800">₹{(totalSanctioned + totalStudentPaid).toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-slate-200 mx-2"></div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Registry Balance</span>
                    <span className={`text-sm font-black ${pendingFromStudent > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>₹{pendingFromStudent.toLocaleString()}</span>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-4 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 rounded transition-colors border border-slate-200"
                >
                  Discard
                </button>
                <button 
                  onClick={wrapSave(onFinalUpdate, 'FINAL')}
                  disabled={saving}
                  className="px-6 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded shadow hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Clock size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Record
                </button>
             </div>
          </footer>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
