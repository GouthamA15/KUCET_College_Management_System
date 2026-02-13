"use client";
import { useState, useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import Navbar from '../../../../components/Navbar';
import NextImage from 'next/image';

const certificateTypes = {
  "Course Completion Certificate": { fee: 100, clerk: "admission" },
  "Income Tax (IT) Certificate": { fee: 0, clerk: "scholarship" },
  "Custodian Certificate": { fee: 100, clerk: "scholarship" },
  "Transfer Certificate (TC)": { fee: 150, clerk: "admission" },
  "Migration Certificate": { fee: 200, clerk: "admission" },
  "Study Conduct Certificate": { fee: 100, clerk: "admission" },
};

export default function CertificateRequestsPage() {
  const router = useRouter();
  const { studentData, loading: contextLoading } = useStudent();
  const [selectedCertificate, setSelectedCertificate] = useState(Object.keys(certificateTypes)[0]);
  const [transactionId, setTransactionId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [requests, setRequests] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fee = certificateTypes[selectedCertificate].fee;

  useEffect(() => {
    if (contextLoading) return;
    if (!studentData) return;

    const s = studentData.student;
    const verified = !!(s?.email) && !!(s?.is_email_verified) && !!(s?.password_hash);
    if (!verified) {
      router.replace('/student/requests/verification-required');
      return;
    }
    fetchRequests();
  }, [studentData, contextLoading, router]);

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null;
    const handler = (e) => setIsMobile(!!e.matches);
    if (mq) {
      setIsMobile(!!mq.matches);
      mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    }
    return () => {
      if (mq) mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
    };
  }, []);

  const handleDownload = async (req) => {
    if (downloadingId) return;
    setDownloadErrors(prev => ({ ...prev, [req.request_id]: null }));
    setDownloadingId(req.request_id);
    try {
      const res = await fetch(`/api/student/requests/download/${req.request_id}`, { method: 'GET', credentials: 'same-origin' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate certificate');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
      let filename = `Certificate_${req.roll_number || 'certificate'}.pdf`;
      if (contentDisp) {
        const filenameStarMatch = contentDisp.match(/filename\*\s*=\s*([^;]+)/i);
        if (filenameStarMatch) {
          let val = filenameStarMatch[1].trim();
          val = val.replace(/^\"/, '').replace(/\"$/, '');
          const parts = val.split("''");
          if (parts.length === 2) {
            try { filename = decodeURIComponent(parts[1]); } catch (e) { filename = parts[1]; }
          } else {
            try { filename = decodeURIComponent(val); } catch (e) { filename = val; }
          }
        } else {
          const filenameMatch = contentDisp.match(/filename\s*=\s*\"?(.*?)\"?(?:;|$)/i);
          if (filenameMatch) filename = filenameMatch[1];
        }
      }
      a.download = filename || `Certificate_${req.roll_number || 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error', error);
      setDownloadErrors(prev => ({ ...prev, [req.request_id]: 'Failed to generate certificate. Try again.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/student/requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        toast.error('Failed to fetch requests.');
      }
    } catch (error) {
      toast.error('An error occurred while fetching requests.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB
        toast.error('File size must be less than 4MB.');
        setPaymentScreenshot(null);
        e.target.value = null; // Reset input
        return;
      }
      setPaymentScreenshot(file);
      toast.success('Image ready for upload.');
    }
  };
  const [purposeOption, setPurposeOption] = useState('Select');
  const [customPurpose, setCustomPurpose] = useState('');
  const commonPurposes = ['Scholarship', 'Internship', 'Education Loan', 'Higher Studies', 'Passport/Visa'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Logic to check if we need payment details
  const needsValidation = fee > 0 || selectedCertificate === "Income Tax (IT) Certificate";

  if (needsValidation && (!transactionId || !paymentScreenshot)) {
    toast.error('Payment details (UTR and Screenshot) are required.');
    return;
  }
    setIsLoading(true);

    const finalPurpose = purposeOption === 'Other' ? customPurpose : purposeOption;
    const formData = new FormData();
    formData.append('certificateType', selectedCertificate);
    formData.append('clerkType', certificateTypes[selectedCertificate].clerk);
    formData.append('paymentAmount', fee);
    formData.append('purpose', finalPurpose);
    if (fee >= 0) {
      formData.append('transactionId', transactionId);
      formData.append('paymentScreenshot', paymentScreenshot);
    }

    try {
      const response = await fetch('/api/student/requests', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success('Request submitted successfully!');
        setSelectedCertificate(Object.keys(certificateTypes)[0]);
        setTransactionId('');
        setPaymentScreenshot(null);
        setPurpose('');
        e.target.reset(); // Reset file input
        fetchRequests();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to submit request.');
      }
    } catch (error) {
      toast.error('An error occurred while submitting the request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <Navbar studentProfileMode={true} activeTab="requests" />
      <main className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Certificate Requests</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">New Request</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="certificate-type" className="block text-sm font-medium text-gray-700">Certificate Type</label>
                  <select
                    id="certificate-type"
                    value={selectedCertificate}
                    onChange={(e) => setSelectedCertificate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {Object.keys(certificateTypes).map(cert => (
                      <option key={cert} value={cert}>{cert}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Fee: <span className="font-bold text-indigo-600">₹{fee}</span></p>
                </div>
                {/* Conditional Note for IT Certificate */}
                {selectedCertificate === "Income Tax (IT) Certificate" && (
                  <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-md">
                    <div className="flex gap-2">
                      <div className="text-blue-600 font-bold">!</div>
                      <p className="text-xs text-blue-700">
                        This certificate is free, but you <strong>must</strong> upload proof of your 
                        <strong> ₹35,000 Yearly College Fee</strong> payment below. Requests without a valid UTR will be rejected.
                      </p>
                    </div>
                  </div>
                )}

                {(fee > 0 || selectedCertificate === "Income Tax (IT) Certificate") && (
                  <>
                    <div className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-center">
                        <h3 className="text-lg font-semibold mb-2">Payment Information</h3>
                      </div>
                        <div className="flex justify-center">
                        <p className="text-red-600 text-sm font-semibold mb-3 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                          Only UPI payments are accepted at the moment
                        </p>
                        </div>
                        <div className="flex justify-center">
                        <p className="text-l font-semibold text-gray-700 mb-4">SCAN & PAY - Enter UTR - Upload the Screenshot</p>
                        </div>
                        <div className="flex items-center justify-center space-x-2 mb-4">
                        <NextImage
                          src="/assets/Payment QR/kucet-logo.png"
                          alt="PRINCIPAL KU"
                          width={36}
                          height={36}
                          className="h-9 w-auto object-contain"
                          onError={(e) => {e.target.style.display = 'none'}} // Hide if broken
                        />
                        <p className="text-sm font-semibold text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
                        </div>
                        <div className="flex justify-center">
                          {fee === 100 && <NextImage src="/assets/Payment QR/ku_payment_100.png" alt="Pay ₹100" width={192} height={192} className="w-48 h-48 border border-gray-200 rounded-md bg-white p-1" />}
                          {fee === 150 && <NextImage src="/assets/Payment QR/ku_payment_150.png" alt="Pay ₹150" width={192} height={192} className="w-48 h-48 border border-gray-200 rounded-md bg-white p-1" />}
                          {fee === 200 && <NextImage src="/assets/Payment QR/ku_payment_200.png" alt="Pay ₹200" width={192} height={192} className="w-48 h-48 border border-gray-200 rounded-md bg-white p-1" />}
                          {selectedCertificate === "Income Tax (IT) Certificate" && <NextImage src="/assets/Payment QR/principal_ku_qr.png" alt="Pay ₹200" width={192} height={192} className="w-48 h-48 border border-gray-200 rounded-md bg-white p-1" />}
                        </div>
                    </div>
                    <div>
                      <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700">
                        Transaction ID / UTR <span className="text-red-500">*</span> <br></br>
                        <span className="text-red-500">(Requests without a valid UTR will be rejected.)</span>
                      </label>
                      <input
                        type="number"
                        id="transaction-id"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                        Purpose of Certificate <span className="text-red-500">*</span>
                      </label>
                      
                      <select
                        value={purposeOption}
                        onChange={(e) => setPurposeOption(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        {commonPurposes.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value="Other">Other (Please specify)</option>
                      </select>

                      {/* Only show the textarea if "Other" is selected */}
                      {purposeOption === 'Other' && (
                        <>
                        <div className="mt-3 space-y-2 flex items-start gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-md">
                          <svg className="h-5 w-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-amber-800">
                            <strong>Note:</strong> Please be careful with the wording as this exact text will be printed on certificate upon approval. 
                            Include the name of the organization if needed  (Eg: TCS on-boarding etc..)
                          </p>
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
                    <div>
                      <label htmlFor="payment-screenshot" className="block text-sm font-medium text-gray-700">
                        Payment Screenshot <span className="text-red-500">*</span><br></br>
                        <span className="text-red-500">(Please upload a valid screenshot. The UTR in the image should match with the one entered above)</span>
                        </label>
                      <input
                        type="file"
                        id="payment-screenshot"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                      />
                       {paymentScreenshot && <p className="text-xs text-green-600 mt-1">Image ready for upload ({(paymentScreenshot.size / 1024).toFixed(2)} KB)</p>}
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Request History</h2>
              {isMobile ? (
                <div className="space-y-3">
                  {requests.length > 0 ? requests.map(req => (
                    <div key={req.request_id} className="w-full border rounded-md p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{req.certificate_type}</div>
                          <div className="text-xs text-gray-500 mt-1">Request ID: <span className="font-medium text-gray-700">{req.request_id}</span></div>
                        </div>
                        <div className="flex items-start flex-col items-end">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                          }`}>{req.status}</span>
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-gray-600">
                        <div>Applied: <span className="font-medium text-gray-800">{new Date(req.created_at).toLocaleDateString()}</span></div>
                        {req.reject_reason && <div className="mt-2 text-sm text-gray-700">Remarks: <span className="font-normal text-gray-800">{req.reject_reason}</span></div>}
                      </div>

                      <div className="mt-3 flex items-center justify-end space-x-3">
                        {req.status === 'APPROVED' ? (
                          <button onClick={() => handleDownload(req)} disabled={!!downloadingId} className="text-indigo-600 hover:text-indigo-900 text-sm">
                            {downloadingId === req.request_id ? 'Please wait...' : 'Download'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-sm text-gray-500">No requests found.</div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certificate</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.length > 0 ? requests.map(req => (
                      <tr key={req.request_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{req.certificate_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {req.status === 'APPROVED' ? (
                              <div className="flex items-center space-x-2">
                                {downloadingId === req.request_id ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    <span className="text-sm text-gray-600">Generating certificate...</span>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => handleDownload(req)} className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 cursor-pointer">
                                      Download
                                    </button>
                                    {downloadErrors[req.request_id] && (
                                      <span className="text-sm text-red-600">{downloadErrors[req.request_id]}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">No requests found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>

        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}