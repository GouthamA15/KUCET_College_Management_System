'use client';
import Header from '@/app/components/Header/Header';
import Footer from '@/components/Footer';
import Navbar from '@/app/components/Navbar/Navbar';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function VerifyContent() {
  const searchParams = useSearchParams();
  const certId = searchParams.get('id');
  const rollNo = searchParams.get('roll');
  
  // Derived state: calculate invalidity immediately
  const missingParams = !certId || !rollNo;

  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    // If parameters are missing, we don't need to do anything as the UI will reflect 'missingParams'
    if (missingParams) {
      return;
    }

    // Call the API only if params exist
    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certId, rollNo }),
    })
    .then(res => res.json())
    .then(result => {
      if (result.valid) {
        setData(result.details);
        setStatus('success');
      } else {
        setStatus('failed');
      }
    })
    .catch(() => setStatus('error'));
  }, [certId, rollNo, missingParams]);

  // Consolidate 'error', 'failed', and 'invalid' (missing params) states for UI rendering
  const showInvalidUI = missingParams || status === 'failed' || status === 'error';
  const showLoadingUI = !missingParams && status === 'loading';
  const showSuccessUI = !missingParams && status === 'success' && data;

  return (
   <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
         <Header />
         <nav className="bg-[#0b3578] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-13">
            <div className="flex-shrink-0">
              <span className="text-white text-lg font-bold tracking-wide">VERIFICATION PORTAL</span>
            </div>
            </div>
            </div>
            </nav>
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      
    
      <div className="bg-white shadow-2xl rounded-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Header Section */}
        <div className="bg-blue-900 p-6 text-center">
          <p className="text-white text-xl font-semibold tracking-tight">Document Verification</p>
        </div>

        <div className="p-8">
          {showLoadingUI && (
            <div className="flex flex-col items-center py-10">
              <div className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-600 font-medium">Verifying Document...</p>
            </div>
          )}

          {showSuccessUI && (
            <div className="animate-in fade-in duration-700">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
                <span className="text-green-600 text-2xl">✓</span>
                <span className="text-green-800 font-bold uppercase">Verified Record</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Student Name</span>
                  <span className="text-slate-900 font-medium text-lg">{data.name}</span>
                </div>
                <div className="flex flex-col border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Hall Ticket Number</span>
                  <span className="text-slate-900 font-medium text-lg">{data.roll_no}</span>
                </div>
                <div className="flex flex-col border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Certificate ID</span>
                  <span className="text-slate-900 font-medium text-lg">{data.cert_id}</span>
                </div>
                <div className="flex flex-col border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Issue Date</span>
                  <span className="text-slate-900 font-medium text-lg">{data.issue_date}</span>
                </div>
              </div>

              <p className="mt-8 text-5px] text-slate-600 text-center leading-relaxed">
                This verification result is retrieved directly from our database.
              </p>
            </div>
          )}

          {showInvalidUI && (
            <div className="text-center py-6 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
              <h2 className="text-xl font-bold text-slate-800">Invalid Certificate</h2>
              <p className="text-slate-500 mt-2 text-sm">
                The certificate details provided do not match our records. 
                Please ensure you have scanned a genuine QR code.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    <Footer/>
    </div>
  );
}

// Wrapper with Suspense
export default function VerifyPage() {
  return (
    
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
