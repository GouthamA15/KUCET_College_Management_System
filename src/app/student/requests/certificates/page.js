"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
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
  const [selectedCertificate, setSelectedCertificate] = useState(Object.keys(certificateTypes)[0]);
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [requests, setRequests] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const fee = certificateTypes[selectedCertificate].fee;

  useEffect(() => {
    // Route-level guard: block unverified accounts from accessing requests
    const init = async () => {
      try {
        const meRes = await fetch('/api/student/me');
        if (!meRes.ok) return; // if unauthorized, let other guards handle
        const { roll_no } = await meRes.json();
        if (!roll_no) return;
        const studentRes = await fetch(`/api/student/${roll_no}`);
        if (!studentRes.ok) return;
        const data = await studentRes.json();
        const s = data?.student;
        const verified = !!(s?.email) && !!(s?.is_email_verified) && !!(s?.password_hash);
        if (!verified) {
          router.replace('/student/requests/verification-required');
          return;
        }
        await fetchRequests();
      } catch (e) {
        // ignore guard errors
      }
    };
    init();
  }, [router]);

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB
        toast.error('File size should be less than 2MB.');
        return;
      }
      try {
        const options = {
          maxSizeMB: 0.05, // 50KB
          maxWidthOrHeight: 800,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        setPaymentScreenshot(compressedFile);
        toast.success('Image compressed and ready for upload.');
      } catch (error) {
        toast.error('Image compression failed. Please try another image.');
        setPaymentScreenshot(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fee > 0 && !transactionId) {
      toast.error('Transaction ID is required for paid certificates.');
      return;
    }
    if (fee > 0 && !paymentScreenshot) {
      toast.error('Payment screenshot is required for paid certificates.');
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append('certificateType', selectedCertificate);
    formData.append('clerkType', certificateTypes[selectedCertificate].clerk);
    formData.append('paymentAmount', fee);
    if (fee > 0) {
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

                {fee > 0 && (
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
                        </div>
                    </div>
                    <div>
                      <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700">Transaction ID / UTR</label>
                      <input
                        type="number"
                        id="transaction-id"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="payment-screenshot" className="block text-sm font-medium text-gray-700">Payment Screenshot</label>
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
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        // prevent duplicate clicks
                                        if (downloadingId) return;
                                        setDownloadErrors(prev => ({ ...prev, [req.request_id]: null }));
                                        setDownloadingId(req.request_id);
                                        try {
                                          const res = await fetch(`/api/student/requests/download/${req.request_id}`, {
                                            method: 'GET',
                                            credentials: 'same-origin',
                                          });
                                          if (!res.ok) {
                                            const err = await res.json().catch(() => ({}));
                                            throw new Error(err.error || 'Failed to generate certificate');
                                          }
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          // Try to get filename from Content-Disposition header (supports filename* and filename)
                                          const contentDisp = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
                                          let filename = `Certificate_${req.roll_number || 'certificate'}.pdf`;
                                          if (contentDisp) {
                                            // Prefer filename* (RFC5987) which may be encoded
                                            const filenameStarMatch = contentDisp.match(/filename\*\s*=\s*([^;]+)/i);
                                            if (filenameStarMatch) {
                                              let val = filenameStarMatch[1].trim();
                                              val = val.replace(/^\"/, '').replace(/\"$/, '');
                                              const parts = val.split("''");
                                              if (parts.length === 2) {
                                                try {
                                                  filename = decodeURIComponent(parts[1]);
                                                } catch (e) {
                                                  filename = parts[1];
                                                }
                                              } else {
                                                try { filename = decodeURIComponent(val); } catch (e) { filename = val; }
                                              }
                                            } else {
                                              const filenameMatch = contentDisp.match(/filename\s*=\s*\"?(.*?)\"?(?:;|$)/i);
                                              if (filenameMatch) filename = filenameMatch[1];
                                            }
                                          }
                                          a.download = filename || `Certificate_${req.roll_number || 'certificate'}.pdf`;
                                          // helpful debug when filenames are still wrong
                                          console.debug('Certificate download filename chosen:', a.download, 'Content-Disposition:', contentDisp);
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
                                      }}
                                      className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 cursor-pointer"
                                    >
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
            </div>
          </div>

        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
