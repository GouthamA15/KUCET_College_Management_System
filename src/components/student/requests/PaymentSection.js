'use client';

import React from 'react';
import NextImage from 'next/image';
import { useAssets } from '@/context/AssetContext';

const PaymentSection = ({ onFileChange, selectedFile, isSubmitting }) => {
  const { getAsset } = useAssets();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        Payment & Fee Details
      </h2>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Instructions */}
        <div className="space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
            <h3 className="text-sm font-bold text-blue-800 uppercase mb-2">Instructions</h3>
            <ul className="text-sm text-blue-700 space-y-2 list-disc ml-4">
              <li>Scan any of the QR codes on the right to pay.</li>
              <li>Alternatively, use the institutional account details.</li>
              <li>Note down the <b>Transaction ID / UTR</b>.</li>
              <li>Upload a clear <b>screenshot</b> of the payment success screen.</li>
            </ul>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 uppercase mb-2">Bank Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold">Account:</span> Principal, KU College of Engineering</p>
              <p><span className="font-semibold">Bank:</span> State Bank of India (SBI)</p>
              <p><span className="font-semibold">A/c No:</span> 30201020304</p>
              <p><span className="font-semibold">IFSC:</span> SBIN0020262</p>
            </div>
          </div>
        </div>

        {/* Right Side: QR Codes */}
        <div className="space-y-6">
          <div className="flex flex-col items-center p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <div className="flex items-center gap-3 mb-4">
              <NextImage 
                src={getAsset('/assets/Payment QR/kucet-logo.png')} 
                alt="Logo" width={32} height={32} 
                className="opacity-80"
              />
              <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Scan to Pay</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {/* 100 QR */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-1 bg-white rounded shadow-sm border border-gray-100">
                  <NextImage src={getAsset('/assets/Payment QR/ku_payment_100.png')} alt="Pay ₹100" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">₹100 (Bonafide/NOC)</span>
              </div>
              {/* 150 QR */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-1 bg-white rounded shadow-sm border border-gray-100">
                  <NextImage src={getAsset('/assets/Payment QR/ku_payment_150.png')} alt="Pay ₹150" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
                </div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">₹150 (Completion)</span>
              </div>
              {/* 200 QR */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-1 bg-white rounded shadow-sm border border-gray-100">
                  <NextImage src={getAsset('/assets/Payment QR/ku_payment_200.png')} alt="Pay ₹200" width={140} height={140} className="w-36 h-36 border border-gray-200 rounded-sm bg-white" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">₹200 (Transfer/Migration)</span>
              </div>
            </div>
            
            <p className="mt-4 text-[11px] text-gray-400 text-center">
              Verified Merchant: KU College of Engineering & Tech <br/>
              Institutional Payment Gateway
            </p>
          </div>
        </div>
      </div>

      {/* Upload Field */}
      <div className="mt-8 pt-8 border-t border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Upload Payment Screenshot (JPG/PNG) <span className="text-red-500">*</span>
        </label>
        <div className="relative group">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={isSubmitting}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer border border-gray-300 rounded-lg p-1"
            required
          />
          {selectedFile && (
            <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Selected: {selectedFile.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSection;
