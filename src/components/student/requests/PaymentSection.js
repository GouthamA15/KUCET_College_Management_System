"use client";
import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { useAssets } from '@/context/AssetContext';

export default function PaymentSection({ fee, selectedCertificate, upiVPA }) {
  const { getAsset } = useAssets();
  const [isMobile, setIsMobile] = useState(false);
  const [paymentMode, setPaymentMode] = useState('qr'); // 'qr' | 'upi'

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

  const requiresPayment = fee > 0;
  const upiAvailable = !!upiVPA && requiresPayment;

  useEffect(() => {
    if (!requiresPayment) return;
    if (isMobile) {
      setPaymentMode('upi');
    } else {
      setPaymentMode('qr');
    }
  }, [isMobile, requiresPayment]);

  const upiLink = upiAvailable && requiresPayment
    ? `upi://pay?pa=${encodeURIComponent(upiVPA)}&pn=${encodeURIComponent('PRINCIPAL KU COLLEGE OF ENGIN')}&am=${encodeURIComponent(String(fee))}&cu=INR&tn=${encodeURIComponent(selectedCertificate)}`
    : null;

  const qrImagePath = requiresPayment
    ? `/assets/Payment QR/ku_payment_${fee}.png`
    : null;

  if (!requiresPayment) return null;

  return (
    <div className="p-2 md:p-3 border border-gray-200 rounded-sm bg-white">
      <div className="flex justify-center">
        <h3 className="text-base md:text-lg font-semibold mb-1 text-[#0b2447]">Payment Information</h3>
      </div>
      <div className="flex justify-center">
        <p className="text-gray-700 text-sm md:text-base mb-2">Only UPI payments are accepted currently</p>
      </div>

      {isMobile && (
        <div className="mt-2 mb-3 flex justify-center">
          <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 overflow-hidden text-xs md:text-sm">
            <button
              type="button"
              onClick={() => setPaymentMode('qr')}
              className={`px-3 md:px-4 py-1.5 md:py-2 border-r border-gray-300 ${
                paymentMode === 'qr'
                  ? 'bg-[#3258a8] text-white'
                  : 'bg-white text-gray-700'
              }`}
            >
              QR
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('upi')}
              className={`px-3 md:px-4 py-1.5 md:py-2 ${
                paymentMode === 'upi'
                  ? 'bg-[#3258a8] text-white'
                  : 'bg-white text-gray-700'
              }`}
            >
              UPI
            </button>
          </div>
        </div>
      )}

      {paymentMode === 'qr' && (
        <>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <NextImage
              src={getAsset('/assets/Payment QR/kucet-logo.png')}
              alt="PRINCIPAL KU"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
            <p className="text-xs md:text-sm font-medium text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
          </div>
          <div className="flex justify-center">
            {qrImagePath && (
              <NextImage
                src={getAsset(qrImagePath)}
                alt={`Pay \\u20B9${fee}`}
                width={140}
                height={140}
                className="w-36 h-36 border border-gray-200 rounded-sm bg-white"
              />
            )}
          </div>
          <div className="mt-2 flex justify-center">
            <p className="text-xs text-gray-600">SCAN & PAY.</p>
          </div>
        </>
      )}

      {paymentMode === 'upi' && upiAvailable && (
        <div className="flex flex-col items-center gap-2">
          <a
            href={upiLink}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#3258a8] text-white text-sm font-medium"
          >
            Tap to Pay via UPI
          </a>
          <p className="text-xs text-gray-700">
            UPI ID: <span className="font-medium">{upiVPA}</span>
          </p>
          <p className="text-xs text-gray-700">
            Amount: <span className="font-medium">₹{fee}</span>
          </p>
        </div>
      )}

      {paymentMode === 'upi' && !upiAvailable && (
        <div className="mt-2 flex justify-center">
          <p className="text-xs text-red-600 text-center">
            UPI payment not available. Please use QR.
          </p>
        </div>
      )}
    </div>
  );
}
