"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';
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
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [purposeOption, setPurposeOption] = useState('Select');
  const [customPurpose, setCustomPurpose] = useState('');
  const commonPurposes = ['Scholarship', 'Internship', 'Education Loan', 'Higher Studies', 'Passport/Visa'];

  const needsValidation = fee > 0 || selectedCertificate === 'Income Tax (IT) Certificate';

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
    if (needsValidation && (!transactionId || !paymentScreenshot)) {
      toast.error('Payment details (UTR and Screenshot) are required.');
      return;
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
    <div className="bg-white p-5 md:p-6 rounded-lg shadow-md">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-4">New Request</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="certificate-type" className="block text-sm font-medium text-gray-700">Certificate Type</label>
          <select
            id="certificate-type"
            value={selectedCertificate}
            onChange={(e) => setSelectedCertificate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {certificateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Fee: <span className="font-semibold text-indigo-600">₹{fee}</span></p>
        </div>

        {selectedCertificate === 'Income Tax (IT) Certificate' && (
          <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-md">
            <div className="flex gap-2">
              <div className="text-blue-600 font-bold">!</div>
              <p className="text-xs text-blue-700">
                This certificate is free, but you must upload proof of your ₹35,000 yearly college fee payment below. Requests without a valid UTR will be rejected.
              </p>
            </div>
          </div>
        )}

        {needsValidation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Payment Details */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="mb-3">
                <div className="inline-block px-3 py-1 text-xs md:text-sm bg-red-50 text-red-700 border border-red-200 rounded">
                  Only UPI payments are accepted currently
                </div>
              </div>
              <PaymentSection fee={fee} selectedCertificate={selectedCertificate} upiVPA={upiVPA} />
              <div className="mt-3">
                <p className="text-sm text-gray-700">Payment Fee: <span className="font-semibold text-indigo-600">₹{fee}</span></p>
              </div>
              <div className="mt-3">
                <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700">
                  Transaction ID / UTR <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="transaction-id"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700">Purpose of Certificate <span className="text-red-500">*</span></label>
                <select
                  value={purposeOption}
                  onChange={(e) => setPurposeOption(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="Select">Select</option>
                  {['Scholarship', 'Internship', 'Education Loan', 'Higher Studies', 'Passport/Visa'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Other">Other (Please specify)</option>
                </select>
                {purposeOption === 'Other' && (
                  <>
                    <div className="mt-2 space-y-2 flex items-start gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-md">
                      <svg className="h-5 w-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-amber-800">Note: This text prints on the certificate. Include organization name if relevant.</p>
                    </div>
                    <textarea
                      required
                      rows={2}
                      value={customPurpose}
                      onChange={(e) => setCustomPurpose(e.target.value)}
                      className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Describe your purpose here..."
                    />
                  </>
                )}
              </div>
              <div className="mt-3">
                <label htmlFor="payment-screenshot" className="block text-sm font-medium text-gray-700">Payment Screenshot <span className="text-red-500">*</span></label>
                <input
                  type="file"
                  id="payment-screenshot"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
                {paymentScreenshot && (
                  <p className="text-xs text-green-600 mt-1">Image ready ({(paymentScreenshot.size / 1024).toFixed(2)} KB)</p>
                )}
              </div>
            </div>

            {/* RIGHT: Screenshot Preview */}
            <div className="bg-gray-50 border rounded-lg p-4 flex flex-col">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 mb-2">Screenshot Preview</h3>
              <div className="flex-1 flex items-center justify-center">
                {!paymentScreenshot ? (
                  <div className="text-sm text-gray-500">No Screenshot Selected</div>
                ) : (
                  <img
                    src={URL.createObjectURL(paymentScreenshot)}
                    alt="Payment Screenshot Preview"
                    className="max-h-96 w-auto object-contain"
                  />
                )}
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
