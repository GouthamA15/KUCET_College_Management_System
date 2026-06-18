"use client";
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import PaymentSection from './PaymentSection';

export default function CertificateRequestForm({
  certificateOptions,
  selectedCertificate,
  setSelectedCertificate,
  fee,
  onSubmit,
  isLoading,
  upiVPA,
}) {
  const [formState, setFormState] = useState({
    transactionId: '',
    paymentScreenshot: null,
    paymentPreviewUrl: null,
    purposeOption: 'Select',
    customPurpose: '',
    fromDate: '',
    toDate: '',
    purposeError: '',
    dateError: '',
  });

  const [eligibilityMap, setEligibilityMap] = useState(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);

  useEffect(() => {
    const isBonafide = selectedCertificate === 'Bonafide Certificate';
    const isTC = selectedCertificate === 'Transfer Certificate (TC)';

    if (isBonafide || isTC) {
      const fetchEligibility = async () => {
        setIsLoadingEligibility(true);
        try {
          const res = await fetch('/api/student/requests/eligibility');
          if (res.ok) {
            const data = await res.json();
            setEligibilityMap(data);
          }
        } catch (error) {
          console.error('Failed to fetch eligibility', error);
        } finally {
          setIsLoadingEligibility(false);
        }
      };
      fetchEligibility();
    } else {
      // Use microtask to avoid synchronous setState in effect body
      Promise.resolve().then(() => setEligibilityMap(null));
    }
  }, [selectedCertificate]);

  const isIncomeTax = selectedCertificate === 'Income Tax (IT) Certificate';
  const isNoObjection = selectedCertificate === 'No Objection Certificate';
  const isBonafide = selectedCertificate === 'Bonafide Certificate';
  const isTC = selectedCertificate === 'Transfer Certificate (TC)';
  const requiresPayment = fee > 0;
  const requiresTransactionId = fee > 0 || isIncomeTax;

  const nocPurposes = [
    'Higher Education',
    'Internship',
    'Industrial Training',
    'Project Work',
    'Passport Application',
    'Visa Application',
    'Employment Opportunity',
    'Competitive Examination',
    'Research Activity'
  ];

  const bonafidePurposes = [
    'Scholarship applications',
    'Education loan requests',
    'Student travel discounts',
    'Visa and passport processing',
    'Internship and workshop applications',
    'Student bank account opening',
    'Job background checks',
    'Employee loan approval',
    'Work visa sponsorships',
    'Official identity proof'
  ];

  const currentPurposes = isNoObjection ? nocPurposes : bonafidePurposes;

  // Show the form whenever a certificate requires any payment proof or fee-related action
  // Also show for No Objection certificate and Bonafide which need purpose + submit even if free
  const showForm = isNoObjection || isIncomeTax || requiresPayment || isBonafide || isTC;

  const fileInputRef = useRef(null);

  const validateNocPurpose = (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return 'Please clearly describe the purpose.';
    if (trimmed.length < 20) return 'Purpose must be at least 20 characters.';
    if (trimmed.length > 300) return 'Purpose must not exceed 300 characters.';
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 3) return 'Purpose must contain at least three words.';
    if (!/[A-Za-z0-9]/.test(trimmed)) return 'Purpose must contain valid descriptive text, not only symbols.';
    return '';
  };

  const validateNocDates = (fromVal, toVal) => {
    if (!fromVal || !toVal) return 'Both From Date and To Date are required.';
    const from = new Date(`${fromVal}T00:00:00`);
    const to = new Date(`${toVal}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'Invalid date range.';
    if (to.getTime() < from.getTime()) return 'To Date cannot be earlier than From Date.';
    return '';
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleRemoveImage = () => {
    if (formState.paymentPreviewUrl) {
      try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (error) {
        console.error('Revoke error', error);
      }
    }
    setFormState(prev => ({
      ...prev,
      paymentScreenshot: null,
      paymentPreviewUrl: null,
    }));
    if (fileInputRef.current) fileInputRef.current.value = null;
    toast('Image removed.');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB.');
        setFormState(prev => ({ ...prev, paymentScreenshot: null }));
        if (e.target) e.target.value = null;
        return;
      }
      // revoke previous preview if present
      if (formState.paymentPreviewUrl) {
        try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (error) {
          console.error('Revoke error', error);
        }
      }
      const preview = URL.createObjectURL(file);
      setFormState(prev => ({
        ...prev,
        paymentScreenshot: file,
        paymentPreviewUrl: preview,
      }));
      toast.success('Image ready for upload.');
    }
  };

  // Clean up preview URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (formState.paymentPreviewUrl) {
        try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (error) {
          console.error('Revoke error', error);
        }
      }
    };
  }, [formState.paymentPreviewUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Purpose & Date Validation for certificates that require them
    const requiresPurpose = isNoObjection || isBonafide || isTC;
    
    if (requiresPurpose) {
      if (formState.purposeOption === 'Select') {
        toast.error('Please select a purpose for the certificate.');
        return;
      }
      
      let purposeValidationError = '';
      if (formState.purposeOption === 'Other') {
        purposeValidationError = validateNocPurpose(formState.customPurpose);
      }
      
      let dateValidationError = '';
      if (isNoObjection) {
        dateValidationError = validateNocDates(formState.fromDate, formState.toDate);
      }
      
      setFormState(prev => ({
        ...prev,
        purposeError: purposeValidationError,
        dateError: dateValidationError,
      }));
      
      if (purposeValidationError || dateValidationError) {
        toast.error('Please fix the highlighted issues before submitting.');
        return;
      }

      const finalPurpose = formState.purposeOption === 'Other' ? formState.customPurpose.trim() : formState.purposeOption;
      
      // If it's NOC, we proceed directly
      if (isNoObjection) {
        await onSubmit({ transactionId: '', paymentScreenshot: null, finalPurpose, fromDate: formState.fromDate, toDate: formState.toDate });
        return;
      }
    }

    // 2. Payment Validation for other certificates
    if (!isIncomeTax && requiresPayment) {
      if (!formState.transactionId || !formState.paymentScreenshot) {
        toast.error('Please enter UTR and upload payment screenshot.');
        return;
      }
    } else if (isIncomeTax) {
      if (!formState.paymentScreenshot) {
        toast.error('Please upload college fee payment screenshot.');
        return;
      }
    }
    
    const finalPurpose = requiresPurpose 
      ? (formState.purposeOption === 'Other' ? formState.customPurpose.trim() : formState.purposeOption)
      : '';

    await onSubmit({ 
      transactionId: formState.transactionId, 
      paymentScreenshot: formState.paymentScreenshot, 
      finalPurpose, 
      fromDate: isNoObjection ? formState.fromDate : null, 
      toDate: isNoObjection ? formState.toDate : null 
    });
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        {/* Certificate Selection Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">New Certificate Request</h2>
          <p className="text-sm text-gray-600 mb-4">Select certificate type and proceed with payment to submit your request.</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="lg:col-span-2">
              <label htmlFor="certificate-type" className="block text-sm font-medium text-gray-700">Certificate Type</label>
              <select
                id="certificate-type"
                value={selectedCertificate}
                onChange={(e) => setSelectedCertificate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm animate-fadeIn"
              >
                {certificateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Institutional Eligibility Display */}
          {(isBonafide || isTC) && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Institutional Eligibility</h3>
                {isLoadingEligibility && (
                  <span className="text-xs text-slate-400 animate-pulse">Verifying records...</span>
                )}
              </div>

              {isBonafide && eligibilityMap?.bonafide && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Attendance */}
                  <div className={`p-4 rounded-md ${eligibilityMap.bonafide.attendance?.isEligible ? 'bg-slate-50' : 'bg-rose-50 text-rose-955'}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${eligibilityMap.bonafide.attendance?.isEligible ? 'text-slate-900' : 'text-rose-700'}`}>
                        {eligibilityMap.bonafide.attendance?.percentage != null ? `${eligibilityMap.bonafide.attendance.percentage.toFixed(1)}%` : 'N/A'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">min 50%</span>
                    </div>
                    {eligibilityMap.bonafide.attendance && !eligibilityMap.bonafide.attendance.thresholdReached && (
                      <p className="text-[10px] text-amber-600 mt-1 font-medium italic">Waiver Applied</p>
                    )}
                    {eligibilityMap.bonafide.attendance?.percentage === null && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">Records pending</p>
                    )}
                  </div>

                  {/* Academic Year */}
                  <div className={`p-4 rounded-md ${!eligibilityMap.bonafide.alreadyHasApproved ? 'bg-slate-50' : 'bg-rose-50 text-rose-955'}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Year</p>
                    <div className="mt-1">
                      <span className="text-base font-bold text-slate-900">{eligibilityMap.bonafide.academicYear || '—'}</span>
                    </div>
                    {eligibilityMap.bonafide.alreadyHasApproved && (
                      <p className="text-[10px] text-rose-600 mt-1 font-medium italic font-semibold">Already issued</p>
                    )}
                    {!eligibilityMap.bonafide.alreadyHasApproved && (
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium italic">Available</p>
                    )}
                  </div>

                  {/* Fee Reimbursement */}
                  <div className="p-4 rounded-md bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fee Reimbursement</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-xl font-bold text-slate-900">{eligibilityMap.bonafide.feeReimbursement || 'NO'}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${eligibilityMap.bonafide.feeReimbursement !== 'NO' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">Institutional Status</p>
                  </div>
                </div>
              )}

              {isTC && eligibilityMap?.tc && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Final Year Completion */}
                  <div className={`p-4 rounded-md ${eligibilityMap.tc.isFinalYearCompleted ? 'bg-slate-50' : 'bg-rose-50'}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Status</p>
                    <div className="mt-1">
                      <span className={`text-sm font-bold ${eligibilityMap.tc.isFinalYearCompleted ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {eligibilityMap.tc.isFinalYearCompleted ? 'FINAL YEAR COMPLETED' : 'FINAL YEAR NOT COMPLETED'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">Based on Academic Calendar</p>
                  </div>

                  {/* Fee Dues */}
                  <div className={`p-4 rounded-md ${eligibilityMap.tc.hasNoDues ? 'bg-slate-50' : 'bg-rose-50'}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Financial Status</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${eligibilityMap.tc.hasNoDues ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {eligibilityMap.tc.hasNoDues ? 'NO DUES' : `₹${eligibilityMap.tc.pendingDues}`}
                      </span>
                      {!eligibilityMap.tc.hasNoDues && <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Outstanding</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">Clearance Required</p>
                  </div>
                </div>
              )}

              {!isLoadingEligibility && (
                (isBonafide && !eligibilityMap?.bonafide?.isEligible) || 
                (isTC && !eligibilityMap?.tc?.isEligible)
              ) && (
                <div className="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-md">
                  <p className="text-xs text-rose-800 font-medium">
                    <span className="font-bold">Access Blocked:</span> {isBonafide ? eligibilityMap?.bonafide?.reason : eligibilityMap?.tc?.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {isIncomeTax && (
            <div className="mt-4 p-3.5 bg-blue-50 border-l-4 border-blue-500 rounded-md animate-fadeIn">
              <h4 className="text-sm font-semibold text-blue-800">Upload College Fee Payment Proof</h4>
              <p className="text-xs text-blue-700 mt-0.5">Please upload screenshot of your college fee payment receipt below.</p>
            </div>
          )}
        </div>

        {/* Payment & Upload Sections */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-gray-100 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Section (Left Column) */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-3 font-medium">Payment Details</h3>
                  <PaymentSection fee={fee} selectedCertificate={selectedCertificate} upiVPA={upiVPA} />
                </div>
                
                <div className="mt-4">
                  {fee > 0 ? (
                    <p className="text-sm text-gray-700">Payment Fee: <span className="font-semibold text-[#0b3578]">₹{fee}</span></p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-750 font-semibold text-emerald-600">No additional payment required.</p>
                      {isBonafide && <p className="text-xs text-gray-500 italic">Fee waived: One-time payment for Bonafide valid for entire course.</p>}
                    </div>
                  )}
                </div>

                {requiresTransactionId && (
                  <div className="mt-4">
                    <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700">Transaction ID / UTR</label>
                    <input
                      type="text"
                      id="transaction-id"
                      value={formState.transactionId}
                      onChange={(e) => {
                        const val = (e.target.value || '').replace(/\D/g, '').slice(0, 12);
                        setFormState(prev => ({ ...prev, transactionId: val }));
                      }}
                      onPaste={(e) => {
                        const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
                        const digits = paste.replace(/\D/g, '');
                        e.preventDefault();
                        const el = e.target;
                        const start = el.selectionStart || 0;
                        const end = el.selectionEnd || 0;
                        const current = (el.value || '').replace(/\D/g, '');
                        const before = current.slice(0, start);
                        const after = current.slice(end);
                        const newVal = (before + digits + after).slice(0, 12);
                        setFormState(prev => ({ ...prev, transactionId: newVal }));
                        requestAnimationFrame(() => {
                          const caret = Math.min((before + digits).length, 12);
                          el.selectionStart = el.selectionEnd = caret;
                        });
                      }}
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={12}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Upload & Submit Section (Right Column) */}
              <div className="space-y-6">
                {/* Upload Section */}
                {(requiresPayment || isIncomeTax) && !isNoObjection ? (
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-2">
                      {requiresPayment && !isIncomeTax ? 'Upload UPI Payment Screenshot' : isIncomeTax ? 'Upload College Fee Payment Screenshot' : 'Upload Payment Proof'}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {isIncomeTax ? 'Upload screenshot of college fee payment receipt.' : 'Upload your UPI payment screenshot (PNG/JPEG, <1MB).'}
                    </p>

                    <div className="mb-3">
                      <div className="max-h-[200px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center p-4 relative bg-slate-50/50">
                        {!formState.paymentScreenshot ? (
                          <div className="text-center text-gray-400 py-6">
                            <div className="mb-1 font-medium text-sm">No Screenshot Selected</div>
                            <div className="text-xs">Drag & drop or use upload button</div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center relative">
                            <Image src={formState.paymentPreviewUrl} alt="Payment Screenshot Preview" width={320} height={140} className="max-h-[140px] w-auto object-contain rounded-md" unoptimized />
                            <button type="button" onClick={handleRemoveImage} className="absolute -top-1 -right-1 bg-white border border-gray-300 rounded-full p-1 text-gray-600 hover:bg-gray-100 shadow-sm cursor-pointer w-6 h-6 flex items-center justify-center font-bold text-sm">
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <input
                        type="file"
                        id="payment-screenshot"
                        accept="image/*"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        className="hidden"
                      />
                      <button type="button" onClick={handleUploadClick} className="px-4 py-2 bg-[#0b3578] text-white rounded-md text-sm font-medium hover:bg-[#0a2d66] transition-colors cursor-pointer">Upload Image</button>
                      {formState.paymentScreenshot && (
                        <div className="mt-2 text-center text-xs">
                          <span className="text-gray-700 font-medium block truncate max-w-xs">{formState.paymentScreenshot.name}</span>
                          <span className="text-emerald-600 font-medium">Ready ({(formState.paymentScreenshot.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  !isNoObjection && !isBonafide && !isTC && (
                    <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-md">
                      <p className="text-xs text-emerald-800 font-semibold">This request is free. No payment screenshot required.</p>
                    </div>
                  )
                )}

                {/* Purpose & Dates */}
                {(isNoObjection || isBonafide || isTC) && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Purpose of Certificate <span className="text-red-500">*</span></label>
                      <select
                        value={formState.purposeOption}
                        onChange={(e) => setFormState(prev => ({ 
                          ...prev, 
                          purposeOption: e.target.value,
                          purposeError: e.target.value === 'Other' ? validateNocPurpose(formState.customPurpose) : ''
                        }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                      >
                        <option value="Select">Select Purpose</option>
                        {currentPurposes.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value="Other">Other (Please specify)</option>
                      </select>
                    </div>

                    {formState.purposeOption === 'Other' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Specify Purpose <span className="text-red-500">*</span></label>
                        <textarea
                          rows={3}
                          value={formState.customPurpose}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setFormState(prev => ({
                              ...prev,
                              customPurpose: newValue,
                              purposeError: validateNocPurpose(newValue),
                            }));
                          }}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                          placeholder="Ex: Internship programme in X institution, passport verification, etc."
                        />
                        <p className="text-[11px] mt-1 text-gray-500">
                          Please clearly describe the purpose (min 20 characters).
                        </p>
                      </div>
                    )}

                    {formState.purposeError && (
                      <p className="text-xs text-red-600 mt-1">{formState.purposeError}</p>
                    )}

                    {isNoObjection && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">From Date <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={formState.fromDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormState(prev => ({
                                ...prev,
                                fromDate: val,
                                dateError: validateNocDates(val, formState.toDate),
                              }));
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">To Date <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={formState.toDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormState(prev => ({
                                ...prev,
                                toDate: val,
                                dateError: validateNocDates(formState.fromDate, val),
                              }));
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                          />
                        </div>
                      </div>
                    )}
                    {isNoObjection && formState.dateError && (
                      <p className="text-xs text-red-600 mt-1">{formState.dateError}</p>
                    )}
                  </div>
                )}

                {/* Submit button wrapper */}
                <div className="pt-4 flex justify-end">
                  {(() => {
                    const nocPurposeInvalid = isNoObjection && (
                      formState.purposeOption === 'Select' || 
                      (formState.purposeOption === 'Other' && !!validateNocPurpose(formState.customPurpose))
                    );
                    const nocDatesInvalid = isNoObjection && !!validateNocDates(formState.fromDate, formState.toDate);
                    
                    const paymentInvalid = !isNoObjection && (
                      (requiresPayment && !isIncomeTax && (!formState.transactionId || !formState.paymentScreenshot)) ||
                      (isIncomeTax && !formState.paymentScreenshot)
                    );

                    const bonafideInvalid = isBonafide && eligibilityMap?.bonafide && !eligibilityMap.bonafide.isEligible;
                    const tcInvalid = isTC && eligibilityMap?.tc && !eligibilityMap.tc.isEligible;

                    const isSubmitDisabled = isLoading || nocPurposeInvalid || nocDatesInvalid || paymentInvalid || bonafideInvalid || tcInvalid || ((isBonafide || isTC) && isLoadingEligibility);
                    
                    return (
                      <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full sm:w-auto inline-flex items-center px-6 py-2.5 rounded-md text-sm font-semibold text-white bg-[#0b3578] hover:bg-[#0a2d66] active:bg-[#092554] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578] disabled:bg-gray-300 transition-colors justify-center cursor-pointer min-w-[160px]"
                      >
                        {isLoading ? 'Submitting...' : 'Submit Request'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
