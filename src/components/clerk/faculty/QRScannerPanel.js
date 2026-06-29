'use client';
import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import toast from 'react-hot-toast';

export default function QRScannerPanel({ onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  
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
        
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
          // Parse logic:
          // Type 1: Just roll number: '23567T0942'
          // Type 2: Detailed text containing 'HT-No : 245670967L' or 'HT-no : ...'
          let rollNo = decodedText.trim();
          
          if (rollNo.includes('HT-No') || rollNo.includes('HT-no')) {
            const lines = rollNo.split('\n');
            const htLine = lines.find(l => l.toUpperCase().includes('HT-NO'));
            if (htLine) {
              const parts = htLine.split(':');
              if (parts.length > 1) {
                rollNo = parts[1].trim();
              }
            }
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

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
          .catch((err) => {
            console.error("QR Scanner startup error:", err);
            toast.error("Camera access denied or unavailable.");
            setIsScanning(false);
          });
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
          onClick={() => setIsScanning(!isScanning)}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-95 ${
            isScanning 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isScanning ? 'Stop Scanner' : 'Start Camera'}
        </button>
      </div>

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
