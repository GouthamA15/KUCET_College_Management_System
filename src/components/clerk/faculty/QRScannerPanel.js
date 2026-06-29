'use client';
import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import toast from 'react-hot-toast';

export default function QRScannerPanel({ onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  
  // Keep the latest callback in a ref to avoid re-triggering useEffect
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let html5QrCode;
    
    if (isScanning) {
      // Need a small timeout to ensure the DOM element is fully rendered before mounting scanner
      const timer = setTimeout(() => {
        html5QrCode = new Html5Qrcode("qr-reader", {
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: false
          }
        });
        
        const qrCodeSuccessCallback = (decodedText) => {
          // Parse logic:
          // Type 1: Just roll number: '23567T0942'
          // Type 2: Detailed text containing 'HT-No : 245670967L' or 'HT-no : ...'
          let rollNo = decodedText.trim();
          
          const match = rollNo.match(/HT-No\s*:\s*([A-Za-z0-9]+)/i);
          if (match) {
            rollNo = match[1].trim();
          }
          
          // Basic cleanup - remove any non-alphanumeric just in case
          rollNo = rollNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          
          if (rollNo) {
            setLastScanned(rollNo);
            if (onScanSuccessRef.current) {
              onScanSuccessRef.current(rollNo);
            }
          }
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        const startCamera = async () => {
          try {
            // First try rear camera (ideal for phones)
            await html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
          } catch (err) {
            console.warn("Environment camera failed, trying user camera...", err);
            try {
              // Fallback to front camera (ideal for laptops)
              await html5QrCode.start({ facingMode: "user" }, config, qrCodeSuccessCallback);
            } catch (fallbackErr) {
              console.error("QR Scanner startup error (both cameras failed):", fallbackErr);
              
              let errMsg = "Camera access denied or unavailable.";
              
              const ua = navigator.userAgent || navigator.vendor || window.opera;
              const isWebView = (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Instagram') > -1) || (ua.indexOf('WhatsApp') > -1) || (ua.indexOf('wv') > -1);
              
              if (isWebView) {
                errMsg = "You are using an In-App Browser (like WhatsApp or Instagram) which blocks camera access. Please tap the top right menu and select 'Open in Chrome/Safari'.";
              } else if (typeof window !== 'undefined' && !window.isSecureContext) {
                errMsg = "Camera requires HTTPS. If testing locally, use localhost or ngrok.";
              } else if (fallbackErr?.name === 'NotAllowedError' || (typeof fallbackErr === 'string' && fallbackErr.includes('NotAllowedError'))) {
                errMsg = "Camera permission blocked. Click the 'Lock' or settings icon next to the URL in your browser and allow Camera access.";
              }
              
              setScannerError(errMsg);
              toast.error(errMsg, { duration: 6000 });
              setIsScanning(false);
            }
          }
        };

        startCamera();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                html5QrCode.clear();
              }).catch(console.error);
            } else {
              html5QrCode.clear();
            }
          } catch (e) {
            console.error("Cleanup error", e);
          }
        }
      };
    }
  }, [isScanning]);

  return (
    <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-xl mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h3 className="text-emerald-900 font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-emerald-400' : 'bg-gray-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isScanning ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
            </span>
            Zero Trust Scanner
          </h3>
          <p className="text-xs text-emerald-700 mt-1">
            {isScanning ? 'Camera active. Point at student ID QR code to mark present.' : 'Start the scanner to begin marking attendance.'}
          </p>
        </div>
        
        <button
          onClick={() => {
            if (!isScanning) setScannerError(null);
            setIsScanning(!isScanning);
          }}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-95 ${
            isScanning 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isScanning ? 'Stop Scanner' : 'Start Camera'}
        </button>
      </div>

      {scannerError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p className="font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Camera Error
          </p>
          <p className="mt-1 ml-7">{scannerError}</p>
        </div>
      )}

      {isScanning && (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/2 max-w-sm mx-auto md:mx-0 overflow-hidden rounded-xl border-2 border-emerald-300 bg-black">
            <div id="qr-reader" className="w-full"></div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center bg-white p-6 rounded-xl border border-emerald-100 shadow-inner">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Last Scanned</p>
            {lastScanned ? (
              <div className="text-center animate-fadeIn">
                <p className="text-3xl font-black text-emerald-600 tracking-tight">{lastScanned}</p>
                <p className="text-xs text-emerald-500 font-bold mt-2 bg-emerald-50 px-2 py-1 rounded inline-block">
                  Marked Present
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic font-medium">No ID scanned yet...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
