'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';
import Link from 'next/link';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Lock, 
  Copy, 
  Check, 
  FileText, 
  HelpCircle,
  ArrowRight,
  Info,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StudentDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

function formatApaarDisplay(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export default function StudentApaarClient() {
  const { studentData, loading, refreshData } = useStudent();
  const student = studentData?.student || null;

  const [apaarInput, setApaarInput] = useState('');
  const [confirmApaarInput, setConfirmApaarInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);
  const [localApaarId, setLocalApaarId] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const modalCloseRef = useRef(null);
  const previouslyFocusedElement = useRef(null);

  // Authoritative APAAR ID from context or local submission state
  const effectiveApaarId = student?.apaar_id || student?.personal_details?.apaar_id || localApaarId || null;
  const isSubmitted = !!effectiveApaarId;

  // Manage modal scroll lock and focus restoration
  useEffect(() => {
    if (!isConfirmModalOpen) return;

    previouslyFocusedElement.current = typeof document !== 'undefined' ? document.activeElement : null;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      modalCloseRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        setIsConfirmModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current?.focus) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isConfirmModalOpen, submitting]);

  const handleInputChange = (e) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 12);
    setApaarInput(formatApaarDisplay(digitsOnly));
    if (formError) setFormError('');
  };

  const handleConfirmChange = (e) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 12);
    setConfirmApaarInput(formatApaarDisplay(digitsOnly));
    if (formError) setFormError('');
  };

  const handleCopyId = () => {
    if (!effectiveApaarId) return;
    navigator.clipboard.writeText(String(effectiveApaarId).replace(/\s+/g, ''));
    setCopied(true);
    toast.success('APAAR ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const clean = apaarInput.replace(/\s+/g, '');
    const cleanConfirm = confirmApaarInput.replace(/\s+/g, '');

    if (!/^\d{12}$/.test(clean)) {
      setFormError('APAAR ID must be exactly 12 numeric digits.');
      return;
    }

    if (!/^\d{12}$/.test(cleanConfirm)) {
      setFormError('Confirmation APAAR ID must be exactly 12 numeric digits.');
      return;
    }

    if (clean !== cleanConfirm) {
      setFormError('APAAR IDs do not match. Please verify both fields.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    const clean = apaarInput.replace(/\s+/g, '');
    setSubmitting(true);
    const toastId = toast.loading('Registering and locking APAAR ID...');

    try {
      const res = await fetch('/api/student/apaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apaar_id: clean })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to submit APAAR ID');
      }

      toast.success('APAAR ID registered and locked successfully!', { id: toastId });
      setLocalApaarId(clean);
      setApaarInput('');
      setConfirmApaarInput('');
      setIsConfirmModalOpen(false);

      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      setFormError(err.message || 'Submission failed');
      toast.error(err.message || 'Submission failed', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !student) {
    return <StudentDashboardSkeleton />;
  }

  if (!student) {
    return (
      <div className="p-8 text-center text-slate-500">
        Student identity not found. Please log in again.
      </div>
    );
  }

  return (
    <div className="space-y-6 antialiased">
      {/* Page Header — Clean standard layout adhering to KUCET CMS visual conventions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              APAAR ID Guidance &amp; Submission
            </h1>
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified &amp; Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Action Required
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            Automated Permanent Academic Account Registry — The Government of India&apos;s lifelong 12-digit academic identity for university credit transfers, degree verification, and scholarship audits.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <Link
            href="/student/finances"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>View in Finances</span>
          </Link>
        </div>
      </header>

      {/* Main Status / Submission Section */}
      {isSubmitted ? (
        <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Bank of Credits</span>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified &amp; Locked
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-800">
                  Your 12-Digit APAAR ID is Officially Verified
                </h2>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  Linked to your KUCET student account ({student.roll_no}) for national credit bank synchronization and state scholarship compliance. In accordance with university regulatory standards, student self-service editing is permanently locked.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between sm:justify-start gap-3 self-start md:self-center shrink-0 w-full sm:w-auto">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">APAAR ID Number</div>
                <div className="font-mono text-lg sm:text-xl font-bold text-[#0b3578] tracking-widest">
                  {formatApaarDisplay(effectiveApaarId)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                title="Copy APAAR ID"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition cursor-pointer"
                aria-label="Copy APAAR ID to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Need a correction? Contact the KUCET Admission or Scholarship Office with your official DigiLocker APAAR card.</span>
            </div>
            <Link
              href="/student/finances"
              className="text-[#0b3578] font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>Check Finances Card</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Bank of Credits</span>
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required
                </span>
              </div>
              <h2 className="text-base font-semibold text-slate-800">
                Register Your 12-Digit APAAR ID
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Enter and confirm the 12-digit APAAR ID obtained from DigiLocker or the official APAAR portal. Ensure accuracy before submitting; once registered, the record is immediately locked to maintain institutional audit integrity.
              </p>
            </div>
          </div>

          {/* Privacy Clarification Notice */}
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Privacy Notice:</strong> KUCET collects only your 12-digit APAAR ID for scholarship processing and academic credit transfers. We do <strong>not</strong> collect or store your Aadhaar number or Aadhaar card documents on this page.
            </div>
          </div>

          <form onSubmit={handlePreSubmit} className="pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {/* Field 1: APAAR ID */}
              <div className="space-y-1">
                <label htmlFor="apaar-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  APAAR ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="apaar-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                    placeholder="1234 5678 9012"
                    value={apaarInput}
                    onChange={handleInputChange}
                    className="w-full font-mono text-sm sm:text-base font-bold tracking-widest px-3.5 py-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] text-slate-800 placeholder:text-slate-300 placeholder:font-normal"
                    disabled={submitting}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-400">
                    {apaarInput.replace(/\s+/g, '').length}/12
                  </div>
                </div>
              </div>

              {/* Field 2: Confirm APAAR ID */}
              <div className="space-y-1">
                <label htmlFor="confirm-apaar-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Confirm APAAR ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-apaar-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                    placeholder="1234 5678 9012"
                    value={confirmApaarInput}
                    onChange={handleConfirmChange}
                    className="w-full font-mono text-sm sm:text-base font-bold tracking-widest px-3.5 py-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] text-slate-800 placeholder:text-slate-300 placeholder:font-normal"
                    disabled={submitting}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-400">
                    {confirmApaarInput.replace(/\s+/g, '').length}/12
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={
                  submitting || 
                  apaarInput.replace(/\s+/g, '').length !== 12 || 
                  confirmApaarInput.replace(/\s+/g, '').length !== 12
                }
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md text-white bg-[#0b3578] hover:bg-[#082654] disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Submit &amp; Lock</span>
              </button>

              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Don&apos;t have an APAAR ID yet? Follow the 5-minute DigiLocker guide below.</span>
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal Dialog Before Saving */}
      {isConfirmModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-apaar-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setIsConfirmModalOpen(false);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 id="confirm-apaar-title" className="text-base sm:text-lg font-bold text-slate-900">
                    Confirm APAAR ID Submission
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Permanent Record Registration</span>
                </div>
              </div>
              <button
                ref={modalCloseRef}
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Entered APAAR ID</span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[#0b3578] tracking-widest">
                {apaarInput}
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please confirm that you have entered your correct 12-digit APAAR ID. KUCET will use this information for scholarship processing and other authorized academic and administrative purposes. Once submitted, you will not be able to edit it yourself. If you submit an incorrect ID, contact the admission or scholarship office for correction.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer text-center"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmedSubmit}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#0b3578] hover:bg-[#082654] disabled:opacity-50 rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Confirm &amp; Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Guidance Section (Organized into 10 Authoritative Points) */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#0b3578] shrink-0" />
              <span>Official Student Guidance: Obtaining Your APAAR ID</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative instructions for undergraduate and postgraduate engineering students of Kakatiya University.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://apaar.education.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0b3578] bg-blue-50/80 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition"
            >
              <span>APAAR Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.digilocker.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0b3578] bg-blue-50/80 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition"
            >
              <span>DigiLocker</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* 10 Numbered Guide Blocks — Clean responsive grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Item 1 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">1</span>
              <span>What is an APAAR ID?</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              APAAR (Automated Permanent Academic Account Registry) is a specialized 12-digit identification number established under the National Education Policy (NEP 2020) by the Ministry of Education, Government of India. Commonly known as &quot;One Nation, One Student ID&quot;, it acts as a digital academic passport that consolidates all your degrees, grade cards, micro-credentials, and scholarship sanctions into a unified national ledger.
            </p>
          </div>

          {/* Item 2 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">2</span>
              <span>Official Government Issuing Channels</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              APAAR IDs are issued exclusively by the Ministry of Education through the national Academic Bank of Credits (ABC) portal and DigiLocker. <strong>KUCET does not independently generate APAAR numbers</strong>; students must generate their ID via official government platforms and submit the verified 12 digits here for institutional records.
            </p>
          </div>

          {/* Item 3 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">3</span>
              <span>Information &amp; Documents Required</span>
            </div>
            <ul className="text-slate-600 space-y-1.5 list-disc pl-11 leading-relaxed">
              <li><strong>12-digit Aadhaar Number</strong> for demographic e-KYC consent on DigiLocker.</li>
              <li><strong>Active Mobile Number</strong> linked to Aadhaar to receive UIDAI one-time passwords.</li>
              <li><strong>Institution Details:</strong> Type: <em>University</em> • Name: <em>Kakatiya University</em>.</li>
              <li><strong>Student Roll Number:</strong> Your official KUCET Hall Ticket number (e.g. {student.roll_no}).</li>
            </ul>
          </div>

          {/* Item 4 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">4</span>
              <span>Step-by-Step Application Walkthrough</span>
            </div>
            <ol className="text-slate-600 space-y-1 list-decimal pl-11 leading-relaxed">
              <li>Log in to the DigiLocker app or website (<a href="https://www.digilocker.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#0b3578] underline">digilocker.gov.in</a>).</li>
              <li>Go to <strong>Search Documents</strong> and search for <em>Academic Bank of Credits</em> or <em>APAAR</em>.</li>
              <li>Select <strong>APAAR / ABC ID Card</strong> issued by the Ministry of Education.</li>
              <li>Confirm your personal details (Name, Date of Birth, Gender).</li>
              <li>Select Institution Type as <strong>University</strong> and Institution Name as <strong>Kakatiya University</strong>.</li>
              <li>Enter your Roll Number ({student.roll_no}) and submit Aadhaar consent.</li>
              <li>Your 12-digit APAAR ID is generated instantly on your virtual card.</li>
            </ol>
          </div>

          {/* Item 5 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">5</span>
              <span>What if Roll Number is Not Yet Generated?</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              If you are a newly admitted student and your university hall ticket or roll number has not yet been assigned by Kakatiya University, you do not need to rush. APAAR submission does not block your admission or access to college facilities. You can return to DigiLocker and submit your APAAR ID here once your official roll number appears on your KUCET ID card.
            </p>
          </div>

          {/* Item 6 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">6</span>
              <span>Troubleshooting Generation Failures</span>
            </div>
            <ul className="text-slate-600 space-y-1 list-disc pl-11 leading-relaxed">
              <li>Verify that your mobile number is actively registered with your Aadhaar at <a href="https://myaadhaar.uidai.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#0b3578] underline">myaadhaar.uidai.gov.in</a>.</li>
              <li>Ensure you have selected <em>Kakatiya University</em> rather than individual affiliated colleges.</li>
              <li>Clear your browser cache or use the official DigiLocker mobile application.</li>
            </ul>
          </div>

          {/* Item 7 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">7</span>
              <span>What if Personal Details Do Not Match?</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              Your name, date of birth, and gender in DigiLocker must match your official Class 10 (SSC) certificate. If your Aadhaar contains an incorrect name or birth year, update your Aadhaar at the nearest authorized Aadhaar Seva Kendra. If your KUCET college record has a typo, bring your original certificates to the KUCET Admission Office for correction.
            </p>
          </div>

          {/* Item 8 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">8</span>
              <span>Submitting Your ID into the CMS</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              Once you have obtained your 12-digit number from DigiLocker or the APAAR portal, return to this page (<code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">/student/apaar</code>). Enter and confirm the 12 numeric digits in the registration box above and click <strong>&quot;Submit &amp; Lock&quot;</strong>.
            </p>
          </div>

          {/* Item 9 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">9</span>
              <span>Strict Read-Only Post-Submission Policy</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              Upon submission, your APAAR ID is immediately validated and committed to the university registry. <strong>To prevent fraudulent replacement and maintain compliance with state scholarship audit trails, the student portal cannot edit or delete this number once submitted.</strong> Any necessary demographic or registration correction must be routed through the KUCET Admission or Scholarship Section.
            </p>
          </div>

          {/* Item 10 */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[#0b3578] font-bold uppercase tracking-wider text-[11px]">
              <span className="w-5 h-5 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-xs shrink-0">10</span>
              <span>Where to View Your Submitted ID</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-7">
              After successful registration, your verified APAAR ID is always displayed on this page as a verified credential, and in your financial and scholarship overview under <Link href="/student/finances" className="text-[#0b3578] font-semibold underline">/student/finances</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
