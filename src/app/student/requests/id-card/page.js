"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import ScrollHandler from '../certificates/ScrollHandler';
import toast from 'react-hot-toast';
import CertificatePageLayout from '../../../../components/student/requests/CertificatePageLayout';
import CertificateRequestForm from '../../../../components/student/requests/CertificateRequestForm';
import RequestHistoryDesktop from '../../../../components/student/requests/RequestHistoryDesktop';
import RequestHistoryMobile from '../../../../components/student/requests/RequestHistoryMobile';
import RejectDetailsModal from '../../../../components/student/requests/RejectDetailsModal';
import { smoothScrollToId } from '@/lib/scroll-utils';

const UPI_VPA = 'kuengineeringcollege@sbi';

const certificateOptions = [
  { value: 'ID Card Reissue', label: 'ID Card Reissue', fee: 150, clerk: 'admission' },
];

export default function IDCardReissuePage() {
  const router = useRouter();
  const { studentData, loading: contextLoading, certificateRequests, setCertificateRequests, certificateRequestsLoaded, setCertificateRequestsLoaded, isLoadingRequests, setIsLoadingRequests } = useStudent();
  const [selectedCertificate, setSelectedCertificate] = useState(certificateOptions[0].value);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReq, setRejectReq] = useState(null);

  const selectedOption = certificateOptions[0];
  const fee = selectedOption.fee;

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true);
      const response = await fetch('/api/student/requests', { method: 'GET', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const rows = Array.isArray(data) ? data : (data?.data || []);
        setCertificateRequests(rows);
        setCertificateRequestsLoaded(true);
      } else {
        toast.error('Failed to fetch requests.');
      }
    } catch (error) {
      toast.error('An error occurred while fetching requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [setCertificateRequests, setCertificateRequestsLoaded, setIsLoadingRequests]);

  useEffect(() => {
    if (!studentData) return;
    const s = studentData.student;
    const verified = !!(s?.email) && !!(s?.is_email_verified) && !!(s?.password_hash);
    if (!verified) {
      router.replace('/student/requests/verification-required');
      return;
    }
    if (!certificateRequestsLoaded) {
      fetchRequests();
    }
  }, [studentData, certificateRequestsLoaded, fetchRequests, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const timeoutId = setTimeout(() => {
      setIsMobile(mq.matches);
    }, 0);
    const handler = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => {
        clearTimeout(timeoutId);
        mq.removeEventListener('change', handler);
      };
    } else {
      mq.addListener(handler);
      return () => {
        clearTimeout(timeoutId);
        mq.removeListener(handler);
      };
    }
  }, []);

  const handleDownload = async (req) => {
    toast.error('ID Cards are physical and cannot be downloaded online. Please collect from the office once approved.');
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
    if (!req) return;
    setSelectedCertificate(req.certificate_type);
    closeRejectModal();
    smoothScrollToId('certificate-type', { behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async ({ transactionId, paymentScreenshot, finalPurpose, fromDate, toDate }) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('certificateType', selectedCertificate);
    formData.append('clerkType', selectedOption.clerk);
    formData.append('paymentAmount', fee);
    formData.append('purpose', finalPurpose);
    if (fromDate) formData.append('fromDate', fromDate);
    if (toDate) formData.append('toDate', toDate);
    if (transactionId) formData.append('transactionId', transactionId);
    if (paymentScreenshot) formData.append('paymentScreenshot', paymentScreenshot);

    try {
      const response = await fetch('/api/student/requests', {
        method: 'POST',
        body: formData,
        cache: 'no-store'
      });
      if (response.ok) {
        await fetchRequests();
        toast.success('ID Card Reissue request submitted successfully!');
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

  // Filter requests to show only ID Card Reissue
  const idCardRequests = (certificateRequests || []).filter(req => req.certificate_type === 'ID Card Reissue');

  return (
    <>
      <Suspense fallback={null}>
        <ScrollHandler />
      </Suspense>

      <CertificatePageLayout
        title="ID Card Reissue"
        left={
          <CertificateRequestForm
            key={selectedCertificate}
            certificateOptions={certificateOptions}
            selectedCertificate={selectedCertificate}
            setSelectedCertificate={setSelectedCertificate}
            fee={fee}
            selectedOption={selectedOption}
            onSubmit={handleSubmit}
            upiVPA={UPI_VPA}
            isLoading={isLoading}
          />
        }
        bottom={
          isMobile ? (
            <RequestHistoryMobile
              requests={idCardRequests}
              downloadingId={downloadingId}
              downloadErrors={downloadErrors}
              onDownload={handleDownload}
              onOpenRejectModal={openRejectModal}
              isLoadingRequests={isLoadingRequests}
            />
          ) : (
            <RequestHistoryDesktop
              requests={idCardRequests}
              downloadingId={downloadingId}
              downloadErrors={downloadErrors}
              onDownload={handleDownload}
              onOpenRejectModal={openRejectModal}
              isLoadingRequests={isLoadingRequests}
            />
          )
        }
      />

      <RejectDetailsModal isOpen={showRejectModal} request={rejectReq} onClose={closeRejectModal} onReapply={handleReapply} />
    </>
  );
}