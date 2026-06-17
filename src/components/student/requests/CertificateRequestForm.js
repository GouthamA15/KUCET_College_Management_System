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

  const [eligibility, setEligibility] = useState(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);

  useEffect(() => {
    if (selectedCertificate === 'Bonafide Certificate') {
      const fetchEligibility = async () => {
        setIsLoadingEligibility(true);
        try {
          const res = await fetch('/api/student/requests/eligibility');
          if (res.ok) {
            const data = await res.json();
            setEligibility(data);
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
      Promise.resolve().then(() => setEligibility(null));
    }
  }, [selectedCertificate]);

  const commonPurposes = [
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

  const isIncomeTax = selectedCertificate === 'Income Tax (IT) Certificate';
  const isNoObjection = selectedCertificate === 'No Objection Certificate';
  const isBonafide = selectedCertificate === 'Bonafide Certificate';
  const requiresPayment = fee > 0;
  const requiresTransactionId = fee > 0 || isIncomeTax;

  // Show the form whenever a certificate requires any payment proof or fee-related action
  // Also show for No Objection certificate and Bonafide which need purpose + submit even if free
  const showForm = isNoObjection || isIncomeTax || requiresPayment || isBonafide;

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
    // Special handling for No Objection: requires purpose (dropdown) and dates
    if (isNoObjection) {
      if (formState.purposeOption === 'Select') {
        toast.error('Please select a purpose for the certificate.');
        return;
      }
      
      let purposeValidationError = '';
      if (formState.purposeOption === 'Other') {
        purposeValidationError = validateNocPurpose(formState.customPurpose);
      }
      
      const dateValidationError = validateNocDates(formState.fromDate, formState.toDate);
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
      await onSubmit({ transactionId: '', paymentScreenshot: null, finalPurpose, fromDate: formState.fromDate, toDate: formState.toDate });
      return;
    }

    // Conditional validation per certificate type based on fee
    if (!isIncomeTax && requiresPayment) {
      // Requires both UTR and screenshot
      if (!formState.transactionId || !formState.paymentScreenshot) {
        toast.error('Please enter UTR and upload payment screenshot.');
        return;
      }
    } else if (isIncomeTax) {
      // Requires only screenshot
      if (!formState.paymentScreenshot) {
        toast.error('Please upload college fee payment screenshot.');
        return;
      }
    }
    
    // Purpose is hidden and not required for other certificates
    await onSubmit({ transactionId: formState.transactionId, paymentScreenshot: formState.paymentScreenshot, finalPurpose: '', fromDate: null, toDate: null });
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        {/* Certificate Selection Section */}
        <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm">
          <h2 className="text-2xl font-semibold text-[#0b2447] mb-2">New Certificate Request</h2>
          <p className="text-sm text-gray-600 mb-3">Select certificate type and proceed with payment to submit your request.</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="lg:col-span-2">
              <label htmlFor="certificate-type" className="block text-sm font-medium text-gray-700">Certificate Type</label>
              <select
                id="certificate-type"
                value={selectedCertificate}
                onChange={(e) => setSelectedCertificate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {certificateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bonafide Eligibility Display */}
          {isBonafide && (
            <div className="mt-4 p-4 border rounded-sm bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#0b3578] uppercase tracking-wider">Institutional Eligibility</h4>
                {isLoadingEligibility ? (
                  <span className="text-xs text-slate-400 animate-pulse">Verifying records...</span>
                ) : (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${eligibility?.isEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {eligibility?.isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Attendance */}
                <div className={`p-3 border rounded-sm ${eligibility?.attendance?.isEligible ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Attendance</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={`text-lg font-bold ${eligibility?.attendance?.isEligible ? 'text-slate-900' : 'text-rose-700'}`}>
                      {eligibility?.attendance?.percentage != null ? `${eligibility.attendance.percentage.toFixed(1)}%` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500">min 50%</span>
                  </div>
                  {eligibility?.attendance && !eligibility.attendance.thresholdReached && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium italic">Institutional Waiver</p>
                  )}
                  {eligibility?.attendance?.percentage === null && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">Records pending</p>
                  )}
                </div>

                {/* Academic Year */}
                <div className={`p-3 border rounded-sm ${!eligibility?.alreadyHasApproved ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Academic Year</p>
                  <div className="mt-1">
                    <span className="text-sm font-bold text-slate-900">{eligibility?.academicYear || '...'}</span>
                  </div>
                  {eligibility?.alreadyHasApproved && (
                    <p className="text-[10px] text-rose-600 mt-1 font-medium italic">Already issued</p>
                  )}
                  {!eligibility?.alreadyHasApproved && (
                    <p className="text-[10px] text-emerald-600 mt-1 font-medium italic">Available</p>
                  )}
                </div>

                {/* Fee Reimbursement */}
                <div className="p-3 border border-slate-200 rounded-sm bg-white">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Fee Reimbursement</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-lg font-bold text-slate-900">{eligibility?.feeReimbursement || 'NO'}</span>
                    <div className={`h-2 w-2 rounded-full ${eligibility?.feeReimbursement !== 'NO' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 italic">Institutional Status</p>
                </div>
              </div>

              {!isLoadingEligibility && !eligibility?.isEligible && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-sm">
                  <p className="text-xs text-rose-800 font-medium">
                    <span className="font-bold">Access Blocked:</span> {eligibility?.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {isIncomeTax && (
            <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-sm">
              <h4 className="text-sm font-semibold text-blue-800">Upload College Fee Payment Proof</h4>
              <p className="text-sm text-blue-700">Upload screenshot of college fee payment receipt.</p>
            </div>
          )}
        </div>

        {/* Payment & Upload Sections */}
        {showForm && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Card */}
            <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm">
                {/* Removed step pills - structured single form */}
              <PaymentSection fee={fee} selectedCertificate={selectedCertificate} upiVPA={upiVPA} />
              <div className="mt-4">
                {fee > 0 ? (
                  <p className="text-sm text-gray-700">Payment Fee: <span className="font-semibold text-indigo-600">₹{fee}</span></p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700 font-semibold text-green-600">No additional payment required.</p>
                    {isBonafide && <p className="text-xs text-gray-500 italic">Fee waived: One-time payment for Bonafide valid for entire course.</p>}
                  </div>
                )}
              </div>
              {requiresTransactionId && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Transaction ID / UTR</p>
                  <input
                    type="text"
                    id="transaction-id"
                    value={formState.transactionId}
                    // Allow only digits for Transaction ID / UTR and limit to 12 chars
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                </div>
              )}
            </div>

            {/* Upload & Submit Card */}
            <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm flex flex-col">
              {isNoObjection ? (
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700">Purpose of Certificate <span className="text-red-500">*</span></label>
                  <select
                    value={formState.purposeOption}
                    onChange={(e) => setFormState(prev => ({ 
                      ...prev, 
                      purposeOption: e.target.value,
                      purposeError: e.target.value === 'Other' ? validateNocPurpose(formState.customPurpose) : ''
                    }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="Select">Select Purpose</option>
                    {commonPurposes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="Other">Other (Please specify)</option>
                  </select>

                  {formState.purposeOption === 'Other' && (
                    <div className="mt-4">
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
                        className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Ex: Internship programme in X institution, passport verification, etc."
                      />
                      <p className="text-xs mt-1 text-gray-500">
                        Please clearly describe the purpose (min 20 characters).
                      </p>
                    </div>
                  )}

                  {formState.purposeError && (
                    <p className="text-xs text-red-600 mt-1">{formState.purposeError}</p>
                  )}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  {formState.dateError && (
                    <p className="text-xs text-red-600 mt-1">{formState.dateError}</p>
                  )}

                  <p className="text-sm text-gray-500 mt-3">No upload or payment required for No Objection certificate.</p>
                </div>
              ) : (
                <>
                  {(requiresPayment || isIncomeTax) ? (
                    <>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {requiresPayment && !isIncomeTax ? 'Upload UPI Payment Screenshot' : isIncomeTax ? 'Upload College Fee Payment Screenshot' : 'Upload Payment Proof'}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {isIncomeTax ? 'Upload screenshot of college fee payment receipt.' : 'Upload your UPI payment screenshot (PNG/JPEG, <1MB).'}
                      </p>

                      <div className="mb-3">
                        <div className="max-h-[250px] border-2 border-dashed border-gray-300 rounded-sm flex items-center justify-center p-4 relative">
                          {!formState.paymentScreenshot ? (
                            <div className="text-center text-gray-500">
                              <div className="mb-2 font-medium">No Screenshot Selected</div>
                              <div className="text-sm">Use the button below to upload an image</div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center relative">
                              <Image src={formState.paymentPreviewUrl} alt="Payment Screenshot Preview" width={520} height={220} className="max-h-[220px] w-auto object-contain" unoptimized />
                              <button type="button" onClick={handleRemoveImage} className="absolute top-2 right-2 bg-white border border-gray-200 rounded-full p-1 text-gray-600 hover:bg-gray-100">
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Controlled upload UI: hidden input + visible button */}
                      <div className="mt-2 flex flex-col items-center">
                        <input
                          type="file"
                          id="payment-screenshot"
                          accept="image/*"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                          className="hidden"
                        />
                        <button type="button" onClick={handleUploadClick} className="px-4 py-2 bg-[#3258a8] text-white rounded-sm text-sm font-medium hover:bg-[#274f8f]">Upload Image</button>
                        <div className="mt-3 text-center">
                          {formState.paymentScreenshot ? (
                            <>
                              <div className="text-sm text-gray-700">{formState.paymentScreenshot.name}</div>
                              <div className="text-xs text-green-600">Image ready ({(formState.paymentScreenshot.size / 1024).toFixed(2)} KB)</div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">No image selected</div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-sm">
                      <p className="text-sm text-green-700">This request is free. No payment screenshot required. Just click submit.</p>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex justify-center">
                {(() => {
                  const nocPurposeInvalid = isNoObjection && (
                    formState.purposeOption === 'Select' || 
                    (formState.purposeOption === 'Other' && !!validateNocPurpose(formState.customPurpose))
                  );
                  const nocDatesInvalid = isNoObjection && !!validateNocDates(formState.fromDate, formState.toDate);
                  
                  // Payment validation
                  const paymentInvalid = !isNoObjection && (
                    (requiresPayment && !isIncomeTax && (!formState.transactionId || !formState.paymentScreenshot)) ||
                    (isIncomeTax && !formState.paymentScreenshot)
                  );

                  // Bonafide eligibility validation
                  const bonafideInvalid = isBonafide && eligibility && !eligibility.isEligible;

                  const isSubmitDisabled = isLoading || nocPurposeInvalid || nocDatesInvalid || paymentInvalid || bonafideInvalid || (isBonafide && isLoadingEligibility);
                  
                  return (
                    <button
                      type="submit"
                      disabled={isSubmitDisabled}
                      className="inline-flex items-center px-6 py-2 rounded-sm text-sm font-semibold text-white bg-[#3258a8] hover:bg-[#274f8f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3258a8] disabled:bg-gray-400 w-[220px] justify-center"
                    >
                      {isLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  );
                })()}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
