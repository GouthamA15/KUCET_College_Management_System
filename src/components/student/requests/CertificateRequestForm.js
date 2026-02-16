"use client";
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import PaymentSection from './PaymentSection';
import Image from 'next/image';

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
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [purposeOption, setPurposeOption] = useState('Select');
  const [customPurpose, setCustomPurpose] = useState('');
  const commonPurposes = ['Scholarship', 'Internship', 'Education Loan', 'Higher Studies', 'Passport/Visa'];

  const isIncomeTax = selectedCertificate === 'Income Tax (IT) Certificate';

  // Certificates that should display QR / UPI payment options
  const upiRequiredTypes = [
    'Bonafide Certificate',
    'Course Completion Certificate',
    'Custodian Certificate',
    'Transfer Certificate (TC)',
    'Migration Certificate',
    'Study Conduct Certificate',
  ];
  const isUPIRequired = upiRequiredTypes.includes(selectedCertificate);

  // Show the form whenever a certificate requires any payment proof or fee-related action
  const showForm = isUPIRequired || isIncomeTax || fee > 0;

  // Transaction ID is required for certificates that expect a UPI transaction
  const requiresTransactionId = isUPIRequired;

  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleRemoveImage = () => {
    setPaymentScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
    toast('Image removed.');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error('File size must be less than 4MB.');
        setPaymentScreenshot(null);
        e.target.value = null;
        return;
      }
      setPaymentScreenshot(file);
      toast.success('Image ready for upload.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Conditional validation per certificate type
    if (isUPIRequired || (!isIncomeTax && fee > 0)) {
      // Requires both UTR and screenshot
      if (!transactionId || !paymentScreenshot) {
        toast.error('Please enter UTR and upload payment screenshot.');
        return;
      }
    } else if (isIncomeTax) {
      // Requires only screenshot
      if (!paymentScreenshot) {
        toast.error('Please upload college fee payment screenshot.');
        return;
      }
    }
    const finalPurpose = purposeOption === 'Other' ? customPurpose : purposeOption;
    await onSubmit({ transactionId, paymentScreenshot, finalPurpose });
    // Reset local state on success (page controls success via onSubmit)
    setTransactionId('');
    setPaymentScreenshot(null);
    setPurposeOption('Select');
    setCustomPurpose('');
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
              {/* Render payment/QR section only for certificate types that require UPI (Bonafide) */}
              {isUPIRequired && <PaymentSection fee={fee} selectedCertificate={selectedCertificate} upiVPA={upiVPA} />}
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
                    value={transactionId}
                    // Allow only digits for Transaction ID / UTR
                    onChange={(e) => setTransactionId((e.target.value || '').replace(/\D/g, ''))}
                    onPaste={(e) => {
                      const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
                      const digits = paste.replace(/\D/g, '');
                      e.preventDefault();
                      // insert only numeric characters
                      const el = e.target;
                      const start = el.selectionStart || 0;
                      const end = el.selectionEnd || 0;
                      const newVal = (el.value || '').slice(0, start) + digits + (el.value || '').slice(end);
                      setTransactionId(newVal);
                      // move caret after inserted text
                      requestAnimationFrame(() => {
                        el.selectionStart = el.selectionEnd = start + digits.length;
                      });
                    }}
                    inputMode="numeric"
                    pattern="\d*"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                </div>
              )}
            </div>

            {/* Upload & Submit Card */}
            <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isUPIRequired ? 'Upload UPI Payment Screenshot' : isIncomeTax ? 'Upload College Fee Payment Screenshot' : 'Upload Payment Proof'}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {isIncomeTax ? 'Upload screenshot of college fee payment receipt.' : 'Upload your UPI payment screenshot (PNG/JPEG, <4MB).'}
              </p>

              <div className="mb-3">
                <div className="max-h-[250px] border-2 border-dashed border-gray-300 rounded-sm flex items-center justify-center p-4 relative">
                  {!paymentScreenshot ? (
                    <div className="text-center text-gray-500">
                      <div className="mb-2 font-medium">No Screenshot Selected</div>
                      <div className="text-sm">Use the button below to upload an image</div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center relative">
                      <Image src={URL.createObjectURL(paymentScreenshot)} alt="Payment Screenshot Preview" width={400} height={400} unoptimized className="max-h-[220px] w-auto object-contain" />
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
                  {paymentScreenshot ? (
                    <>
                      <div className="text-sm text-gray-700">{paymentScreenshot.name}</div>
                      <div className="text-xs text-green-600">Image ready ({(paymentScreenshot.size / 1024).toFixed(2)} KB)</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No image selected</div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Purpose of Certificate <span className="text-red-500">*</span></label>
                <select
                  value={purposeOption}
                  onChange={(e) => setPurposeOption(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="Select">Select</option>
                  {commonPurposes.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Other">Other (Please specify)</option>
                </select>
                {purposeOption === 'Other' && (
                  <textarea
                    required
                    rows={2}
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Describe your purpose here..."
                  />
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-6 py-2 rounded-sm text-sm font-semibold text-white bg-[#3258a8] hover:bg-[#274f8f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3258a8] disabled:bg-gray-400 w-[220px] justify-center"
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
