'use client';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import ClientShell from '@/components/ClientShell.client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const certId = searchParams.get('id')?.trim();
  const rollNo = searchParams.get('roll')?.trim();
  
  const missingParams = !certId || !rollNo;

  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (missingParams) {
      return;
    }

    const verify = async (locationData = {}) => {
      // Get device info from UA
      let deviceName = 'Unknown Device';
      try {
        const ua = navigator.userAgent;
        if (ua.includes('iPhone')) deviceName = 'iPhone';
        else if (ua.includes('iPad')) deviceName = 'iPad';
        else if (ua.includes('Android')) {
          const match = ua.match(/Android\s+([^\s;]+|[^;)]+)/);
          deviceName = match ? `Android Device (${match[1]})` : 'Android Device';
        } else if (ua.includes('Windows')) deviceName = 'Windows PC';
        else if (ua.includes('Macintosh')) deviceName = 'MacBook/iMac';
      } catch (e) {}

      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          certId, 
          rollNo,
          deviceName,
          latitude: locationData.latitude,
          longitude: locationData.longitude
        }),
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
    };

    // Try to get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          verify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => {
          // If denied or error, verify without location
          verify();
        },
        { timeout: 5000 }
      );
    } else {
      verify();
    }
  }, [certId, rollNo, missingParams]);

  const showInvalidUI = missingParams || status === 'failed' || status === 'error';
  const showLoadingUI = !missingParams && status === 'loading';
  const showSuccessUI = !missingParams && status === 'success' && data;

  return (
   <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
      <HeaderMobileView />
      <Header />
      <ClientShell />

      {/* Main Content Area */}
      <div id="main-content" className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300">
        <div className="flex-1 bg-slate-50 flex items-start sm:items-center justify-center p-5">
          <div className="bg-white shadow-2xl rounded-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Header Section */}
            <div className="bg-[#0b3578] p-6 text-center">
              <p className="text-white text-xl font-semibold tracking-tight uppercase">Document Verification</p>
            </div>

            <div className="p-8">
              {showLoadingUI && (
                <div className="flex flex-col items-center py-10">
                  <div className="w-12 h-12 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-slate-600 font-medium uppercase text-xs tracking-widest">Verifying Document...</p>
                </div>
              )}

              {showSuccessUI && (
                <div className="animate-in fade-in duration-700">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
                    <span className="text-green-600 text-2xl">✓</span>
                    <span className="text-green-800 font-bold uppercase text-sm tracking-widest">Verified Record</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Student Name</span>
                      <span className="text-slate-900 font-bold text-lg">{data.name}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Hall Ticket Number</span>
                      <span className="text-slate-900 font-bold text-lg">{data.roll_no}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Certificate Type</span>
                      <span className="text-slate-900 font-bold text-lg">{data.cert_type}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Certificate ID</span>
                      <span className="text-slate-900 font-bold text-lg">{data.cert_id}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Issue Date</span>
                      <span className="text-slate-900 font-bold text-lg">{data.issue_date}</span>
                    </div>
                  </div>

                  <p className="mt-8 text-[10px] text-slate-400 text-center leading-relaxed uppercase tracking-tighter">
                    This verification result is retrieved directly from our institutional database.
                  </p>
                </div>
              )}

              {showInvalidUI && (
                <div className="text-center py-6 animate-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
                  <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Invalid Certificate</h2>
                  <p className="text-slate-500 mt-2 text-xs leading-relaxed">
                    The certificate details provided do not match our records. 
                    Please ensure you have scanned a genuine QR code.
                  </p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-6 px-6 py-2 bg-[#0b3578] text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-[#0a2d66] transition-all"
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
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}