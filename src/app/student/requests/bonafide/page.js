"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NextImage from 'next/image';

const BONAFIDE = 'Bonafide Certificate';
const FEE = 100; // matches certificateTypes mapping

export default function BonafideRequestPage() {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [requests, setRequests] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});
  const [selectedRejectedRequest, setSelectedRejectedRequest] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewAspect, setPreviewAspect] = useState(9/16); // default portrait 9:16
  const historyRef = useRef(null);

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
      const res = await fetch('/api/student/requests');
      if (!res.ok) {
        toast.error('Failed to load request history.');
        return;
      }
      const data = await res.json();
      setRequests(data || []);
    } catch (e) {
      toast.error('Unable to fetch requests.');
    }
  };

  // create/revoke object URL for preview to avoid memory leaks and allow sizing
  useEffect(() => {
    if (!paymentScreenshot) {
      setPreviewUrl(null);
      setPreviewAspect(9/16);
      return;
    }
    const url = URL.createObjectURL(paymentScreenshot);
    setPreviewUrl(url);

    // measure image natural size to set aspect ratio dynamically
    // Use the DOM Image constructor to measure aspect, not next/image
    const img = new window.Image();
    img.src = url;
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setPreviewAspect(img.naturalWidth / img.naturalHeight);
      } else {
        setPreviewAspect(9/16);
      }
    };

    return () => {
      try { URL.revokeObjectURL(url); } catch (e) {}
      setPreviewUrl(null);
      setPreviewAspect(9/16);
    };
  }, [paymentScreenshot]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast.error('File size should be less than 2MB.');
      return;
    }
    try {
      const options = { maxSizeMB: 0.05, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      setPaymentScreenshot(compressedFile);
      toast.success('Image compressed and ready for upload.');
    } catch (err) {
      setPaymentScreenshot(null);
      toast.error('Image compression failed.');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (FEE > 0 && !transactionId) {
      toast.error('Transaction ID is required.');
      return;
    }
    if (FEE > 0 && !paymentScreenshot) {
      toast.error('Payment screenshot is required.');
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('certificateType', BONAFIDE);
    formData.append('clerkType', 'admission');
    formData.append('paymentAmount', FEE);
    if (FEE > 0) {
      formData.append('transactionId', transactionId);
      formData.append('paymentScreenshot', paymentScreenshot);
    }

    try {
      const res = await fetch('/api/student/requests', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Bonafide request submitted.');
        setTransactionId('');
        setPaymentScreenshot(null);
        // refresh requests then scroll to history
        await fetchRequests();
        try {
          if (historyRef.current) historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { /* ignore scroll errors */ }
      } else {
        toast.error(body.error || 'Failed to submit request.');
      }
    } catch (err) {
      toast.error('Request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString();
    } catch (e) { return iso; }
  };

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
      let filename = `Bonafide_${req.roll_number || 'certificate'}.pdf`;
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
      a.download = filename || `Bonafide_${req.roll_number || 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
      setDownloadErrors(prev => ({ ...prev, [req.request_id]: 'Failed to generate certificate. Try again.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navbar studentProfileMode={true} isSubPage={true} activeTab="requests" onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); window.location.href = '/'; }} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Bonafide Certificate</h1>
          <p className="mt-1 text-sm text-gray-600">Request and download your bonafide certificate</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Left Card: QR + Payment Inputs */}
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2">Payment Information</h3>
            <p className="text-red-600 text-sm font-semibold mb-3 bg-red-50 px-3 py-1 rounded-full border border-red-100">
              Only UPI payments are accepted at the moment
            </p>
            <p className="text-s font-semibold text-gray-700 mb-4">SCAN & PAY - Enter UTR - Upload the Screenshot</p>
            <div className="flex items-center justify-center space-x-2 mb-4">
            <NextImage
              src="/assets/Payment QR/kucet-logo.png"
              alt="PRINCIPAL KU"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
              onError={(e) => {e.target.style.display = 'none'}} // Hide if broken
            />
            <p className="text-sm font-semibold text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
            </div>
             <div className="flex items-center justify-center">
              <NextImage src="/assets/Payment QR/ku_payment_100.png" alt="QR" width={160} height={160} className="w-40 h-40 bg-white rounded-md shadow-lg" />
            </div>
            <div className="w-full mt-4">
              <p className="text-sm text-gray-700 mb-2">Payment Fee: <span className="font-bold text-indigo-600">₹{FEE}</span></p>
              <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700">Transaction ID / UTR</label>
              <input type="number" id="transaction-id" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor" />

              <label htmlFor="payment-screenshot" className="block text-sm font-medium text-gray-700 mt-4">Payment Screenshot</label>
              <input
                type="file"
                id="payment-screenshot"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
              />
              {paymentScreenshot && (
                <p className="text-xs text-green-600 mt-2">Image ready for upload ({(paymentScreenshot.size / 1024).toFixed(2)} KB)</p>
              )}
            </div>
          </div>

          {/* Right Card: Preview + Submit */}
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
            <div className="flex-1 flex items-center justify-center border border-dashed rounded-md p-4" style={{ aspectRatio: previewAspect, maxHeight: '28rem', width: '100%' }}>
                {previewUrl ? (
                  <NextImage src={previewUrl} alt="preview" width={500} height={500} className="w-full h-full object-contain rounded" unoptimized />
              ) : (
                <div className="text-center text-gray-500">No Screenshot Uploaded</div>
              )}
            </div>

            <div className="mt-4">
              <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-2 px-4 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer">
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
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

      </main>

      {/* Rejection reason modal (read-only) */}
      {selectedRejectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col relative">
            <button onClick={() => setSelectedRejectedRequest(null)} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Reason for Rejection</h3>
              <div className="space-y-3 text-sm text-gray-800">
                <p><strong>Certificate Type:</strong> {selectedRejectedRequest.certificate_type || '-'}</p>
                <p><strong>Academic Year:</strong> {selectedRejectedRequest.academic_year || '-'}</p>
                <p><strong>Status:</strong> <span className="text-red-700 font-semibold">Rejected</span></p>
                <div>
                  <h4 className="font-medium">Rejection Reason</h4>
                  <div className="mt-2 p-3 border rounded bg-gray-50 text-sm text-gray-900" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedRejectedRequest.reject_reason || 'No reason provided.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setSelectedRejectedRequest(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}