"use client";
import { useEffect, useState } from 'react';
import NextImage from 'next/image';

export default function PaymentSection({ fee, selectedCertificate, upiVPA }) {
  const [isMobile, setIsMobile] = useState(false);

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

  const showDeepLink = isMobile && !!upiVPA && fee > 0;
  const upiLink = upiVPA
    ? `upi://pay?pa=${encodeURIComponent(upiVPA)}&pn=${encodeURIComponent('PRINCIPAL KU CET')}&am=${fee}&cu=INR`
    : null;

  return (
    <div className="p-3 md:p-4 border rounded-lg bg-gray-50">
      <div className="flex justify-center">
        <h3 className="text-base md:text-lg font-semibold mb-2">Payment Information</h3>
      </div>
      <div className="flex justify-center">
        <p className="text-gray-700 text-sm md:text-base mb-3">Scan & Pay or use UPI below</p>
      </div>
      {!showDeepLink && (
        <>
          <div className="flex items-center justify-center space-x-2 mb-3">
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
              <NextImage src="/assets/Payment QR/ku_payment_100.png" alt="Pay ₹100" width={160} height={160} className="w-40 h-40 border border-gray-200 rounded-md bg-white p-1" />
            )}
            {fee === 150 && (
              <NextImage src="/assets/Payment QR/ku_payment_150.png" alt="Pay ₹150" width={160} height={160} className="w-40 h-40 border border-gray-200 rounded-md bg-white p-1" />
            )}
            {fee === 200 && (
              <NextImage src="/assets/Payment QR/ku_payment_200.png" alt="Pay ₹200" width={160} height={160} className="w-40 h-40 border border-gray-200 rounded-md bg-white p-1" />
            )}
            {selectedCertificate === 'Income Tax (IT) Certificate' && (
              <NextImage src="/assets/Payment QR/principal_ku_qr.png" alt="IT Certificate Payment" width={160} height={160} className="w-40 h-40 border border-gray-200 rounded-md bg-white p-1" />
            )}
          </div>
        </>
      )}

      {showDeepLink && (
        <div className="flex flex-col items-center gap-2">
          <a
            href={upiLink}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Pay Now via UPI
          </a>
          <p className="text-xs text-gray-600">Opens your UPI app with amount prefilled.</p>
        </div>
      )}

      <div className="mt-3 flex justify-center">
        <p className="text-xs text-gray-600">Only UPI payments are accepted currently.</p>
      </div>
    </div>
  );
}
