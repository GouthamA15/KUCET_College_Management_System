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
  selectedOption,
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
  const commonPurposes = ['Scholarship', 'Internship', 'Education Loan', 'Higher Studies', 'Passport/Visa'];

  const isIncomeTax = selectedCertificate === 'Income Tax (IT) Certificate';
  const isNoObjection = selectedCertificate === 'No Objection Certificate';
  const requiresPayment = fee > 0;
  const requiresTransactionId = fee > 0 || isIncomeTax;

  // Show the form whenever a certificate requires any payment proof or fee-related action
  // Also show for No Objection certificate which has no fee/upload but needs a purpose + submit
  const showForm = isNoObjection || isIncomeTax || requiresPayment;

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
      try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (e) {}
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
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File size must be less than 1MB.');
        setFormState(prev => ({ ...prev, paymentScreenshot: null }));
        if (e.target) e.target.value = null;
        return;
      }
      // revoke previous preview if present
      if (formState.paymentPreviewUrl) {
        try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (e) {}
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
        try { URL.revokeObjectURL(formState.paymentPreviewUrl); } catch (e) {}
      }
    };
  }, [formState.paymentPreviewUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Special handling for No Objection: only require a manual purpose
    if (isNoObjection) {
      const purposeValidationError = validateNocPurpose(formState.customPurpose);
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

      const finalPurpose = formState.customPurpose.trim();
      await onSubmit({ transactionId: '', paymentScreenshot: null, finalPurpose, fromDate: formState.fromDate, toDate: formState.toDate });
      return;
    }

    // Validation for standard purpose selection
    if (formState.purposeOption === 'Select') {
      toast.error('Please select a purpose for the certificate.');
      return;
    }
    if (formState.purposeOption === 'Other' && !formState.customPurpose.trim()) {
      toast.error('Please specify your purpose.');
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
    const finalPurpose = formState.purposeOption === 'Other' ? formState.customPurpose.trim() : formState.purposeOption;
    await onSubmit({ transactionId: formState.transactionId, paymentScreenshot: formState.paymentScreenshot, finalPurpose, fromDate: null, toDate: null });
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
            {/* <div className="lg:col-span-1">
              <p className="text-sm font-medium text-gray-700">Fee</p>
              <div className="mt-1 text-lg font-semibold text-indigo-600">₹{fee}</div>
            </div> */}
          </div>
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
                  <p className="text-sm text-gray-700 font-semibold text-green-600">No additional payment required.</p>
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
                    placeholder="Ex: Internship programme in X institution, passport verification, higher studies, event participation, etc."
                  />
                  <p className="text-xs mt-1 text-gray-500">
                    Please clearly describe the purpose (internship, passport verification, higher studies, event participation, etc.).
                  </p>
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

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Purpose of Certificate <span className="text-red-500">*</span></label>
                    <select
                      value={formState.purposeOption}
                      onChange={(e) => setFormState(prev => ({ ...prev, purposeOption: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="Select">Select</option>
                      {commonPurposes.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="Other">Other (Please specify)</option>
                    </select>
                    {formState.purposeOption === 'Other' && (
                      <textarea
                        required
                        rows={2}
                        value={formState.customPurpose}
                        onChange={(e) => setFormState(prev => ({ ...prev, customPurpose: e.target.value }))}
                        className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Describe your purpose here..."
                      />
                    )}
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-center">
                {(() => {
                  const nocPurposeInvalid = isNoObjection && !!validateNocPurpose(formState.customPurpose);
                  const nocDatesInvalid = isNoObjection && !!validateNocDates(formState.fromDate, formState.toDate);
                  
                  // Standard purpose validation
                  const standardPurposeInvalid = !isNoObjection && (
                    formState.purposeOption === 'Select' || 
                    (formState.purposeOption === 'Other' && !formState.customPurpose.trim())
                  );

                  // Payment validation
                  const paymentInvalid = !isNoObjection && (
                    (requiresPayment && !isIncomeTax && (!formState.transactionId || !formState.paymentScreenshot)) ||
                    (isIncomeTax && !formState.paymentScreenshot)
                  );

                  const isSubmitDisabled = isLoading || nocPurposeInvalid || nocDatesInvalid || standardPurposeInvalid || paymentInvalid;
                  
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
