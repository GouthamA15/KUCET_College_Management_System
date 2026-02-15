"use client";
import { useState, useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Footer from '../../../../components/Footer';
import CertificatePageLayout from '../../../../components/student/requests/CertificatePageLayout';
import CertificateRequestForm from '../../../../components/student/requests/CertificateRequestForm';
import RequestHistoryDesktop from '../../../../components/student/requests/RequestHistoryDesktop';
import RequestHistoryMobile from '../../../../components/student/requests/RequestHistoryMobile';
import RejectDetailsModal from '../../../../components/student/requests/RejectDetailsModal';

const certificateOptions = [
  { value: 'Bonafide Certificate', label: 'Bonafide Certificate', fee: 100, clerk: 'admission' },
  { value: 'Course Completion Certificate', label: 'Course Completion Certificate', fee: 100, clerk: 'admission' },
  { value: 'Income Tax (IT) Certificate', label: 'Income Tax (IT) Certificate', fee: 0, clerk: 'scholarship' },
  { value: 'Custodian Certificate', label: 'Custodian Certificate', fee: 100, clerk: 'scholarship' },
  { value: 'Transfer Certificate (TC)', label: 'Transfer Certificate (TC)', fee: 150, clerk: 'admission' },
  { value: 'Migration Certificate', label: 'Migration Certificate', fee: 200, clerk: 'admission' },
  { value: 'Study Conduct Certificate', label: 'Study Conduct Certificate', fee: 100, clerk: 'admission' },
];

export default function CertificateRequestsPage() {
  const router = useRouter();
  const { studentData, loading: contextLoading } = useStudent();
  const [selectedCertificate, setSelectedCertificate] = useState(certificateOptions[0].value);
  const [requests, setRequests] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReq, setRejectReq] = useState(null);
  const [historyFlash, setHistoryFlash] = useState(false);
  const searchParams = useSearchParams();

  const selectedOption = certificateOptions.find(o => o.value === selectedCertificate) || certificateOptions[0];
  const fee = selectedOption.fee;

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

  // Smooth scroll to history when coming from activity bar
  useEffect(() => {
    if (!searchParams) return;
    const scrollTarget = searchParams.get('scroll');
    if (scrollTarget === 'history') {
      const doScroll = () => {
        const el = typeof document !== 'undefined' ? document.getElementById('request-history-section') : null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setHistoryFlash(true);
          setTimeout(() => setHistoryFlash(false), 1000);
        }
      };
      setTimeout(doScroll, 150);
    }
  }, [searchParams]);

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

  const openRejectModal = (req) => {
    setRejectReq(req);
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectReq(null);
  };

  const handleReapply = (req) => {
    // Prefill form to allow re-apply
    if (!req) return;
    setSelectedCertificate(req.certificate_type);
    closeRejectModal();
    // Scroll to form
    if (typeof document !== 'undefined') {
      const el = document.getElementById('certificate-type');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const handleSubmit = async ({ transactionId, paymentScreenshot, finalPurpose }) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('certificateType', selectedCertificate);
    formData.append('clerkType', selectedOption.clerk);
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
        setSelectedCertificate(certificateOptions[0].value);
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
      <CertificatePageLayout
        title="Certificate Requests"
        left={
          <CertificateRequestForm
            certificateOptions={certificateOptions}
            selectedCertificate={selectedCertificate}
            setSelectedCertificate={setSelectedCertificate}
            fee={fee}
            selectedOption={selectedOption}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        }
        bottom={
          <div
            id="request-history-section"
            className={historyFlash ? 'bg-indigo-50 transition-colors duration-1000 rounded-lg' : ''}
          >
            {isMobile ? (
              <RequestHistoryMobile
                requests={requests}
                downloadingId={downloadingId}
                downloadErrors={downloadErrors}
                onDownload={handleDownload}
                onOpenRejectModal={openRejectModal}
              />
            ) : (
              <RequestHistoryDesktop
                requests={requests}
                downloadingId={downloadingId}
                downloadErrors={downloadErrors}
                onDownload={handleDownload}
                onOpenRejectModal={openRejectModal}
              />
            )}
          </div>
        }
      />
      <RejectDetailsModal isOpen={showRejectModal} request={rejectReq} onClose={closeRejectModal} onReapply={handleReapply} />
      <Footer />
    </>
  );
}