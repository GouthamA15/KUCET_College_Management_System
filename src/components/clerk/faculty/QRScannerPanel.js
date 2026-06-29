'use client';
import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import toast from 'react-hot-toast';

export default function QRScannerPanel({ onScanSuccess, onScannerStop }) {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  
  // Use refs to track scanner state across rapid re-renders (Strict Mode)
  const scannerRef = useRef(null);
  const isStartingRef = useRef(false);

  // Keep the latest callback in a ref to avoid re-triggering useEffect
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let isMounted = true;
    
    if (isScanning) {
      const initScanner = async () => {
        try {
          if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode("qr-reader", {
              formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
              }
            });
          }
          
          isStartingRef.current = true;
          
          const qrCodeSuccessCallback = (decodedText) => {
            let extractedRoll = null;
            
            // 1. Try to find common ID labels
            const labelMatch = decodedText.match(/(?:HT[-.\s]*No|Hall\s*Ticket(?:[-.\s]*No)?|Roll[-.\s]*No(?:umber)?|ID[-.\s]*No)\s*[:=-]\s*([A-Za-z0-9]+)/i);
            
            if (labelMatch) {
              extractedRoll = labelMatch[1].trim();
            } else {
              // 2. Fallback: Search the entire text for anything that looks like a KUCET roll number
              // Format: YY567TBBSS (Regular) or YY567BBSSL (Lateral)
              const rollPatternMatch = decodedText.match(/\b(\d{2}567T?\d{2}[A-Za-z0-9]{2,3})\b/i);
              if (rollPatternMatch) {
                extractedRoll = rollPatternMatch[1].trim();
              } else {
                // If it's a huge block of text and no roll number was found, don't concatenate it.
                if (decodedText.length < 25) {
                   extractedRoll = decodedText.trim();
                } else {
                   // Log internally and ignore to prevent polluting the scanner with giant strings
                   console.warn("Could not find a valid Roll Number in QR code:", decodedText);
                   return;
                }
              }
            }
            
            const rollNo = extractedRoll.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            
            if (rollNo) {
              setLastScanned(rollNo);
              if (onScanSuccessRef.current) {
                onScanSuccessRef.current(rollNo);
              }
            }
          };

          const config = { fps: 10, qrbox: { width: 250, height: 250 } };
          
          if (selectedCameraId) {
            await scannerRef.current.start(selectedCameraId, config, qrCodeSuccessCallback);
          } else {
            await scannerRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
          }
          
          isStartingRef.current = false;
          
          // If component unmounted while we were waiting for the camera to start
          if (!isMounted) {
            try {
              if (scannerRef.current && scannerRef.current.isScanning) {
                await scannerRef.current.stop();
              }
              if (scannerRef.current) {
                scannerRef.current.clear();
                scannerRef.current = null;
              }
            } catch (e) {
              console.error("Late cleanup error:", e);
            }
          }
        } catch (err) {
          isStartingRef.current = false;
          if (isMounted) {
            console.error("Failed to start camera feed:", err);
            setScannerError("Failed to start camera feed. It might be in use by another app.");
            setIsScanning(false);
          }
        }
      };

      // Ensure the DOM has painted the div
      const timer = setTimeout(() => {
        if (isMounted) initScanner();
      }, 100);
      
      return () => {
        isMounted = false;
        clearTimeout(timer);
        
        if (scannerRef.current) {
          if (isStartingRef.current) {
            // Cannot stop while starting. The promise resolution above will handle it.
          } else {
            try {
              if (scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                  if (scannerRef.current) {
                    scannerRef.current.clear();
                    scannerRef.current = null;
                  }
                }).catch(console.error);
              } else {
                scannerRef.current.clear();
                scannerRef.current = null;
              }
            } catch (e) {
              console.error("Cleanup error", e);
            }
          }
        }
      };
    }
  }, [isScanning, selectedCameraId]);

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
          onClick={async () => {
            if (isScanning) {
              setIsScanning(false);
              setScannerError(null);
              if (onScannerStop) {
                onScannerStop();
              }
              return;
            }
            
            setScannerError(null);
            
            try {
              // Request permission directly in the onClick user-gesture!
              const cameras = await Html5Qrcode.getCameras();
              
              if (cameras && cameras.length > 0) {
                // Find rear camera first, otherwise fallback to first available (laptop webcam)
                const backCamera = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'));
                const targetCamera = backCamera || cameras[0];
                
                setSelectedCameraId(targetCamera.id);
                setIsScanning(true); // Mounts the #qr-reader div and triggers useEffect
              } else {
                setScannerError("No cameras found on your device.");
              }
            } catch (err) {
              console.error("Permission error during getCameras:", err);
              let errMsg = "Camera access denied or unavailable.";
              
              const ua = navigator.userAgent || navigator.vendor || window.opera;
              const isWebView = (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Instagram') > -1) || (ua.indexOf('WhatsApp') > -1) || (ua.indexOf('wv') > -1);
              
              if (isWebView) {
                errMsg = "You are using an In-App Browser (like WhatsApp or Instagram) which blocks camera access. Please tap the top right menu and select 'Open in Chrome/Safari'.";
              } else if (typeof window !== 'undefined' && !window.isSecureContext) {
                errMsg = "Camera requires HTTPS. If testing locally, use localhost or ngrok.";
              } else if (err?.name === 'NotAllowedError' || (typeof err === 'string' && err.includes('NotAllowedError'))) {
                errMsg = "Camera permission blocked. 1) Click the settings icon next to the URL. 2) Check Windows/Mac Privacy settings.";
              } else if (err?.name === 'NotFoundError') {
                errMsg = "No camera found. Ensure it's not disabled by a hardware switch.";
              }
              
              setScannerError(errMsg);
              toast.error(errMsg, { duration: 6000 });
            }
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

      <div className={isScanning ? 'block' : 'hidden'}>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/2 max-w-sm mx-auto md:mx-0 overflow-hidden rounded-xl border-2 border-emerald-300 bg-black min-h-[250px]">
            <div id="qr-reader" className="w-full min-h-[250px]"></div>
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
      </div>
    </div>
  );
}
