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

  // 1. Core data derivation (needed for state and initial logic)
  const proceedings = Array.isArray(summary?.scholarship_proceedings) ? summary.scholarship_proceedings : [];
  const payments = Array.isArray(summary?.student_payments) ? summary.student_payments : [];

  const reimbursementStatus = String(student?.fee_reimbursement || 'NO').toUpperCase();
  const hasScholarshipData = (proceedings.length > 0) || (summary?.application_no && String(summary.application_no).trim() !== '');
  
  const [forceScholarWorkflow, setForceScholarWorkflow] = useState(false);
  const isScholar = reimbursementStatus === 'YES' || reimbursementStatus === 'GOV' || hasScholarshipData || forceScholarWorkflow;

  // 2. Lifecycle hooks
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (isScholar) {
      console.log('[Workflow Mode] Scholarship workflow enabled');
    } else {
      console.log('[Workflow Mode] Non-scholarship payment-only mode enabled');
    }
  }, [open, isScholar]);

  if (!open) return null;

  // 3. Advanced derived values
  const totalFee = getYearlyTotalFee(student?.course);
  const totalSanctioned = proceedings
    .filter(p => (p.status || 'SANCTIONED').toUpperCase() !== 'REJECTED')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalReleased = proceedings
    .filter(p => (p.status || 'SANCTIONED').toUpperCase() !== 'REJECTED')
    .reduce((sum, p) => sum + (Number(p.released_amount) || 0), 0);
  const totalStudentPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // DYNAMIC GOVT CAP: SC/ST/Minority get full fee, others capped at 35k
  const category = String(student?.category || '').toUpperCase();
  const religion = String(student?.religion || '').toUpperCase();
  const isFullReimbursementCategory = ['SC', 'ST'].includes(category) || 
    ['MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'PARSI'].includes(religion);
  
  const GOVT_CAP = (reimbursementStatus === 'GOV' || isFullReimbursementCategory) ? totalFee : 35000;
  const eligibleAmount = isScholar ? GOVT_CAP : 0;

  const allowedStudentPayableLimit = isScholar ? Math.max(0, totalFee - GOVT_CAP) : totalFee;
  const remainingStudentPayable = Math.max(0, allowedStudentPayableLimit - totalStudentPaid);
  const currentPayAmt = Number(formState.payAmount) || 0;
  const isPayOverflow = currentPayAmt > remainingStudentPayable;
  const isPayLimitReached = remainingStudentPayable <= 0;
  
  // Validation for UI
  const currentEntryAmt = Number(formState.schAmount) || 0;
  const currentRelAmt = Number(formState.releasedAmount) || 0;
  const currentStatus = (formState.schStatus || 'SANCTIONED').toUpperCase();
  
  const totalExcludingCurrent = proceedings
    .filter(p => (!formState.selectedProceeding || p.id !== formState.selectedProceeding.id) && (p.status || 'SANCTIONED').toUpperCase() !== 'REJECTED')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const relExcludingCurrent = proceedings
    .filter(p => (!formState.selectedProceeding || p.id !== formState.selectedProceeding.id) && (p.status || 'SANCTIONED').toUpperCase() !== 'REJECTED')
    .reduce((sum, p) => sum + (Number(p.released_amount) || 0), 0);

  const isOverflow = currentStatus !== 'REJECTED' && (totalExcludingCurrent + currentEntryAmt) > GOVT_CAP;
  const isRelOverflow = currentStatus !== 'REJECTED' && (relExcludingCurrent + currentRelAmt) > GOVT_CAP;

  const remainingEligible = Math.max(0, GOVT_CAP - totalSanctioned);
  const balanceToRelease = Math.max(0, totalSanctioned - totalReleased);
  const pendingFromStudent = Math.max(0, totalFee - (totalSanctioned + totalStudentPaid));
  const pendingInstitutionalFee = Math.max(0, totalFee - totalStudentPaid);

  const setField = (k, v) => setFormState?.(k, v);

  // Status computation
  let status = 'Pending';
  let statusColor = 'bg-slate-100 text-slate-600';
  if (isScholar) {
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
  } else {
    if (totalStudentPaid >= totalFee && totalFee > 0) {
      status = 'Paid';
      statusColor = 'bg-emerald-100 text-emerald-700';
    } else if (totalStudentPaid > 0) {
      status = 'Partially Paid';
      statusColor = 'bg-blue-100 text-blue-700';
    } else {
      status = 'Unpaid';
      statusColor = 'bg-slate-100 text-slate-600';
    }
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 overflow-hidden">
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
        <div className="bg-slate-50 w-full max-w-[1200px] h-[90vh] flex flex-col rounded-lg shadow-xl border border-slate-200 overflow-hidden font-sans transform-gpu">
          {/* 1. STICKY MODAL HEADER */}
          <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between sticky top-0 z-20">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700">
                  <ShieldCheck size={18} />
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  {isScholar ? 'Scholarship Financial Processing' : 'Institutional Fee Payments'}
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded">
                  {isScholar ? 'Registry' : 'Payments'}
                </span>
                {(!isScholar && reimbursementStatus === 'NO') && (
                  <button 
                    onClick={() => setForceScholarWorkflow(true)}
                    className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors uppercase tracking-wider"
                  >
                    Enable Scholarship Workflow
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600">
                <span className="font-semibold text-slate-800">{year}</span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-slate-900">{student?.roll_no}</span>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-slate-800 truncate max-w-[280px]">{student?.name}</span>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-indigo-700">{student?.course}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColor}`}>
                {status}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            
            {/* 3. FINANCIAL STATUS SUMMARY */}
            {isScholar ? (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 divide-x divide-slate-200">
                  {[
                    {
                      label: 'Total Sanctioned',
                      value: totalSanctioned,
                      icon: FileText,
                      iconWrap: 'bg-indigo-50 text-indigo-700',
                    },
                    {
                      label: 'Total Released',
                      value: totalReleased,
                      icon: CheckCircle2,
                      iconWrap: 'bg-emerald-50 text-emerald-700',
                    },
                    {
                      label: 'Pending Release',
                      value: balanceToRelease,
                      icon: Clock,
                      iconWrap: 'bg-amber-50 text-amber-700',
                    },
                    {
                      label: 'Remaining Eligible',
                      value: remainingEligible,
                      icon: TrendingUp,
                      iconWrap: 'bg-slate-50 text-slate-700',
                    },
                  ].map((m) => (
                    <div key={m.label} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-1.5 rounded border border-slate-200 ${m.iconWrap}`}>
                          <m.icon size={16} />
                        </div>
                        <div className="text-xl font-bold text-slate-900 tabular-nums">
                          ₹{m.value.toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-600">{m.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-slate-200">
                  {[
                    {
                      label: 'Total Course Fee',
                      value: totalFee,
                      icon: FileText,
                      iconWrap: 'bg-slate-50 text-slate-700',
                    },
                    {
                      label: 'Total Paid',
                      value: totalStudentPaid,
                      icon: CheckCircle2,
                      iconWrap: 'bg-emerald-50 text-emerald-700',
                    },
                    {
                      label: 'Balance Due',
                      value: pendingInstitutionalFee,
                      icon: Clock,
                      iconWrap: 'bg-amber-50 text-amber-700',
                    },
                  ].map((m) => (
                    <div key={m.label} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-1.5 rounded border border-slate-200 ${m.iconWrap}`}>
                          <m.icon size={16} />
                        </div>
                        <div className="text-xl font-bold text-slate-900 tabular-nums">
                          ₹{m.value.toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-600">{m.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-12 gap-6">
              {/* Left Column - Scholarship Operations */}
              {isScholar && (
              <div className="col-span-7 space-y-6">
                
                {/* 4. SCHOLARSHIP DETAILS SECTION */}
                <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-indigo-700" />
                      Scholarship details
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 flex items-center justify-between">
                          Application number
                          {isAppLocked && (
                            <button 
                              onClick={() => setField('appEditing', true)}
                              className="text-indigo-700 hover:text-indigo-900 text-xs font-medium"
                            >
                              Unlock
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
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {formState.appEditing && (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <AlertCircle size={14} />
                            Application numbers propagate across all years. Edit with caution.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Compliance registry</label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-slate-200 cursor-pointer">
                            <input 
                              type="checkbox" 
                              id="hardcopy"
                              checked={!!formState.hardcopySubmitted}
                              onChange={(e) => setField('hardcopySubmitted', e.target.checked)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                            />
                            <span className="text-xs font-medium text-slate-700">Hardcopy</span>
                          </label>

                          <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-slate-200 cursor-pointer">
                            <input 
                              type="checkbox" 
                              id="thumb"
                              checked={!!formState.thumbUpdateAvailable}
                              onChange={(e) => setField('thumbUpdateAvailable', e.target.checked)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                            />
                            <span className="text-xs font-medium text-slate-700">Thumb update</span>
                          </label>
                        </div>

                        {formState.thumbUpdateAvailable && (
                          <div className="mt-3 space-y-2 animate-fadeIn">
                            <label className="text-xs font-medium text-slate-600">Thumb verification status</label>
                            <select 
                              value={formState.thumbStatus || 'PENDING'}
                              onChange={(e) => setField('thumbStatus', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="FAILED">FAILED</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 5. NEW/EDIT PROCEEDING ENTRY SECTION */}
                <section className={`bg-white rounded-lg border overflow-hidden ${formState.selectedProceeding ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className={`bg-slate-50 px-4 py-2.5 border-b flex items-center justify-between ${formState.selectedProceeding ? 'border-amber-200' : 'border-slate-200'}`}>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded border ${formState.selectedProceeding ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                        {formState.selectedProceeding ? <Edit2 size={16} /> : <PlusCircle size={16} />}
                      </span>
                      {formState.selectedProceeding ? 'Update proceeding' : 'Register proceeding'}
                    </h3>
                    {formState.selectedProceeding && (
                      <button 
                        onClick={onCancelEdit}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-4 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Proceeding ID</label>
                        <input 
                          type="text"
                          value={formState.schProceedingNo || ''}
                          onChange={(e) => setField('schProceedingNo', e.target.value)}
                          placeholder="e.g. 152/S1/2023"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Sanctioned amount</label>
                        <div className="relative">
                          <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="number"
                            value={formState.schAmount || ''}
                            onChange={(e) => setField('schAmount', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Sanction date</label>
                        <input 
                          type="date"
                          value={formState.schSanctionDate || ''}
                          onChange={(e) => setField('schSanctionDate', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Released amount</label>
                        <div className="relative">
                          <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="number"
                            value={formState.releasedAmount || ''}
                            onChange={(e) => setField('releasedAmount', e.target.value)}
                            placeholder="Actually disbursed"
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Released date</label>
                        <input 
                          type="date"
                          value={formState.releasedDate || ''}
                          onChange={(e) => setField('releasedDate', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Status</label>
                        <select 
                          value={formState.schStatus || 'SANCTIONED'}
                          onChange={(e) => setField('schStatus', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        >
                          <option value="SANCTIONED">SANCTIONED</option>
                          <option value="RELEASED">RELEASED</option>
                          <option value="PENDING">PENDING</option>
                          <option value="REJECTED">REJECTED (voids dues credit)</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Inline Validation Warnings */}
                    {(Number(formState.schAmount) > remainingEligible && Number(formState.schAmount) > 0) && (
                      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                        <AlertCircle size={16} className="text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-900">Budget warning</p>
                          <p className="text-xs text-amber-700 mt-0.5">Total sanction exceeds remaining eligible cap. Check policy.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button 
                        onClick={wrapSave(onProceedingSave, 'PROCEEDING')}
                        disabled={saving || !formState.schAppNo || !formState.schProceedingNo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0b3578] border border-[#0b3578] text-white text-sm font-semibold rounded-md hover:bg-[#072a5f] transition-colors disabled:opacity-50"
                      >
                        {saving ? <Clock size={16} className="animate-spin" /> : (formState.selectedProceeding ? <Save size={16} /> : <PlusCircle size={16} />)}
                        {saving ? 'Processing...' : (formState.selectedProceeding ? 'Update registry entry' : 'Register proceeding entry')}
                      </button>
                    </div>
                  </div>
                </section>

                {/* 6. EXISTING PROCEEDINGS TABLE */}
                <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <History size={16} className="text-slate-500" />
                      Scholarship proceedings
                    </h3>
                    <span className="text-xs text-slate-500">{proceedings.length} records</span>
                  </div>
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600">Proceeding</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-right">Sanctioned</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-center">Sanction date</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-center">Status</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-right">Released</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {proceedings.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-3 py-10 text-center text-slate-500 text-sm">No proceedings recorded for this year.</td>
                          </tr>
                        ) : (
                          proceedings.map((p) => (
                            <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${p.status === 'REJECTED' ? 'bg-red-50/30' : ''}`}>
                              <td className="px-3 py-2.5">
                                <p className="text-sm font-medium text-slate-900">{p.proceeding_no}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900 tabular-nums">₹{Number(p.amount).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-slate-600">{toDmy(p.date)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  p.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                                  p.status === 'RELEASED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                  'bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}>
                                  {p.status || 'SANCTIONED'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {p.released_amount ? (
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-semibold text-emerald-700 tabular-nums">₹{Number(p.released_amount).toLocaleString()}</p>
                                    <p className="text-xs text-emerald-700/80">{toDmy(p.released_date)}</p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">Pending</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => onSelectProceeding?.(p)}
                                    className="p-2 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Are you sure you want to permanently delete this scholarship proceeding record?')) {
                                        onDeleteScholarship?.(p.id);
                                      }
                                    }}
                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
              )}

              {/* Right Column - Student Operations */}
              <div className={`${isScholar ? 'col-span-5' : 'col-span-12'} space-y-6`}>
                
                {/* 7. STUDENT PAYMENT SECTION */}
                <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <CreditCard size={16} className="text-amber-700" />
                      Student fee payments
                    </h3>
                  </div>

                  <div className="p-4 bg-white space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Amount paid</label>
                        <input 
                          type="number"
                          value={formState.payAmount || ''}
                          onChange={(e) => setField('payAmount', e.target.value)}
                          placeholder="₹0.00"
                          disabled={saving || isPayLimitReached}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition"
                        />
                        <div className="text-xs text-slate-600">
                          <span>Allowed payable limit: </span>
                          <span className="font-semibold text-slate-900 tabular-nums">₹{allowedStudentPayableLimit.toLocaleString()}</span>
                          <span className="mx-1.5 text-slate-300">•</span>
                          <span>Remaining: </span>
                          <span className="font-bold text-slate-900 tabular-nums text-sm">₹{remainingStudentPayable.toLocaleString()}</span>
                        </div>
                        {isPayLimitReached && (
                          <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2">
                            <CheckCircle2 size={16} className="text-emerald-700 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-emerald-900">Payable limit reached</p>
                              <p className="text-xs text-emerald-800 mt-0.5">No more student payments can be recorded for this year.</p>
                            </div>
                          </div>
                        )}
                        {isPayOverflow && (
                          <div className="mt-1 px-3 py-2 bg-red-100 border border-red-300 rounded-md flex items-start gap-2 animate-shake">
                            <AlertCircle size={16} className="text-red-700 mt-0.5" />       
                            <div>
                              <p className="text-xs font-bold text-red-900 uppercase">Payment Not Possible</p>
                              <p className="text-xs text-red-800 mt-0.5 font-medium">
                                This amount exceeds the student&apos;s required payable limit. Reduce it to <span className="underline font-bold tabular-nums">₹{remainingStudentPayable.toLocaleString()}</span> or less to proceed.
                              </p>
                            </div>
                          </div>
                        )}
                        </div>
                        <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Payment date</label>
                        <input 
                          type="date"
                          value={formState.payDate || ''}
                          onChange={(e) => setField('payDate', e.target.value)}
                          disabled={saving || isPayLimitReached}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition"
                        />
                        </div>
                        <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Payment mode</label>
                        <select 
                          value={formState.payMode || 'UPI'}
                          onChange={(e) => setField('payMode', e.target.value)}
                          disabled={saving || isPayLimitReached}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition"
                        >
                          <option value="CASH">CASH</option>
                          <option value="UPI">UPI / QR</option>
                          <option value="BANK_TRANSFER">BANK TRANSFER</option>
                          <option value="DD">DEMAND DRAFT (DD)</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                        </div>
                        <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Bank name</label>
                        <input 
                          type="text"
                          value={formState.bankName || ''}
                          onChange={(e) => setField('bankName', e.target.value)}
                          placeholder="Bank name"
                          disabled={saving || isPayLimitReached}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition"
                        />
                        </div>
                        <div className="col-span-2 space-y-2">
                        <label className="text-xs font-medium text-slate-600">Reference (UTR/Ref No)</label>
                        <input 
                          type="text"
                          value={formState.payRef || ''}
                          onChange={(e) => setField('payRef', e.target.value)}
                          placeholder="e.g. DU15263748"
                          disabled={saving || isPayLimitReached}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition"
                        />
                        </div>
                        </div>
                        <button 
                        onClick={wrapSave(onPaymentSave, 'PAYMENT')}
                        disabled={saving || isPayLimitReached || !formState.payAmount || !formState.payRef || isPayOverflow}
                        className="w-full py-2 bg-[#0b3578] border border-[#0b3578] text-white text-sm font-semibold rounded-md hover:bg-[#072a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {saving ? 'Processing...' : isPayOverflow ? 'Payment Limit Exceeded' : 'Register student payment'}
                        </button>
                  </div>

                  <div className="max-h-[250px] overflow-y-auto border-t border-slate-200">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600">Amount / date</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600">Mode / ref</th>
                          <th className="px-3 py-2 text-xs font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-3 py-8 text-center text-slate-500 text-sm">No student payments recorded.</td>
                          </tr>
                        ) : (
                          payments.slice().reverse().map(p => (
                            <tr key={p.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2.5">
                                <p className="text-sm font-semibold text-slate-900 tabular-nums">₹{Number(p.amount).toLocaleString()}</p>
                                <p className="text-xs text-slate-600 mt-0.5">{toDmy(p.date)}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="text-xs text-slate-700">{p.payment_mode || 'UPI'}</p>
                                <p className="text-xs text-slate-600 font-mono truncate max-w-[160px]">{p.transaction_ref}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button 
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to permanently delete this student fee payment record?')) {
                                      onDeletePayment?.(p.id);
                                    }
                                  }}
                                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-colors"
                                >
                                  <X size={16} />
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
                {isScholar && (
                  <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <TrendingUp size={16} className="text-emerald-700" />
                        Scholarship release status
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[12px] text-slate-600">Sanctioned</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">₹{totalSanctioned.toLocaleString()}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[12px] text-slate-600">Released</div>
                          <div className="text-lg font-bold text-emerald-700 tabular-nums">₹{totalReleased.toLocaleString()}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[12px] text-slate-600">Balance to release</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">₹{balanceToRelease.toLocaleString()}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[12px] text-slate-600">Release rate</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">
                            {totalSanctioned > 0 ? Math.round((totalReleased / totalSanctioned) * 100) : 0}%
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        This is a summary of disbursement against recorded proceedings for the selected year.
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </main>

          {/* 10. STICKY FOOTER ACTIONS */}
          <footer className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between sticky bottom-0 z-20">
            {isScholar ? (
              <div className="flex items-center gap-6 text-[12px] text-slate-700">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500">Total value impact</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">₹{(totalSanctioned + totalStudentPaid).toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500">Registry balance</span>
                  <span className={`text-base font-bold tabular-nums ${pendingFromStudent > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>₹{pendingFromStudent.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-6 text-[12px] text-slate-700">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500">Total paid</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">₹{totalStudentPaid.toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500">Balance due</span>
                  <span className={`text-base font-bold tabular-nums ${pendingInstitutionalFee > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>₹{pendingInstitutionalFee.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={onClose}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Discard
              </button>
              <button 
                onClick={wrapSave(onFinalUpdate, 'FINAL')}
                disabled={saving}
                className="px-4 py-2 bg-[#0b3578] border border-[#0b3578] text-white text-sm font-semibold rounded-md hover:bg-[#072a5f] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Clock size={16} className="animate-spin" /> : <Save size={16} />}
                Save record
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
