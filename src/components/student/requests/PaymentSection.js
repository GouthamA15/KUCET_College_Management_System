'use client';

"use client";
import { useEffect, useState } from 'react';
import NextImage from 'next/image';

export default function PaymentSection({ fee, selectedCertificate, upiVPA }) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);

    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  const showDeepLink = isMobile && !!upiVPA && fee > 0;
  const upiLink = upiVPA
    ? `upi://pay?pa=${encodeURIComponent(upiVPA)}&pn=${encodeURIComponent('PRINCIPAL KU CET')}&am=${fee}&cu=INR`
    : null;
  // Certificates that should display QR / UPI payment options
  const upiRequiredTypes = [
    'Bonafide Certificate',
    'Course Completion Certificate',
    'Custodian Certificate',
    'Transfer Certificate (TC)',
    'Migration Certificate',
    'Study Conduct Certificate',
  ];
  const requiresUPI = upiRequiredTypes.includes(selectedCertificate);
  if (!requiresUPI) return null;

  return (
    <div className="p-2 md:p-3 border border-gray-200 rounded-sm bg-white">
      <div className="flex justify-center">
        <h3 className="text-base md:text-lg font-semibold mb-1 text-[#0b2447]">Payment Information</h3>
      </div>
      <div className="flex justify-center">
        <p className="text-gray-700 text-sm md:text-base mb-2">Scan & Pay or use UPI below</p>
      </div>
      {!showDeepLink && (
        <>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <NextImage
              src="/assets/Payment QR/kucet-logo.png"
              alt="PRINCIPAL KU"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
            <p className="text-xs md:text-sm font-medium text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
          </div>
          <div className="flex justify-center">
            {fee === 100 && (
              <NextImage src="/assets/Payment QR/ku_payment_100.png" alt="Pay ₹100" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
            )}
            {fee === 150 && (
              <NextImage src="/assets/Payment QR/ku_payment_150.png" alt="Pay ₹150" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
            )}
            {fee === 200 && (
              <NextImage src="/assets/Payment QR/ku_payment_200.png" alt="Pay ₹200" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
            )}
          </div>
        </>
      )}

      {showDeepLink && (
        <div className="flex flex-col items-center gap-2">
          <a
            href={upiLink}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#3258a8] text-white text-sm font-medium hover:bg-[#274f8f]"
          >
            Pay Now via UPI
          </a>
          <p className="text-xs text-gray-600">Opens your UPI app with amount prefilled.</p>
        </div>
      )}

      <div className="mt-2 flex justify-center">
        <p className="text-xs text-gray-600">Only UPI payments are accepted currently.</p>
      </div>
    </div>
  );
}
