"use client";
import Header from '../../Header';
import Navbar from '../../Navbar';

export default function CertificatePageLayout({ title = "Certificate Requests", left, right, bottom, children }) {
  const leftZone = "bg-white border border-neutral-300 rounded-md p-6";
  const rightCard = "bg-white border border-gray-300 rounded-md p-4 text-sm";

  return (
    <>
      <Header />
      <Navbar studentProfileMode={true} activeTab={'requests'} onLogout={async () => { try { await fetch('/api/student/logout', { method: 'POST' }); } catch {} finally { localStorage.removeItem('logged_in_student'); sessionStorage.clear(); window.location.replace('/'); } }} />
      <main className="min-h-screen bg-gray-100">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-20 py-6">
          <h1 className="text-3xl font-bold text-[#0b2447] mb-4">{title}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-[3.8fr_1fr] gap-6">
            {/* LEFT COLUMN */}
            <div className="order-2 lg:order-1">
              <div className={leftZone}>
                <div className="space-y-6">
                  {/* Certificate Header + Form (left prop is expected to render its own content) */}
                  <div>{left}</div>

                  {/* Request History label + content - always render wrapper so scroll target exists */}
                  <div id="request-history-section" className="mt-6">
                    <h2 className="text-lg font-semibold tracking-wide text-gray-800 mb-3">Request History</h2>
                    <div className="border-t border-gray-100 pt-4">
                      {bottom ? bottom : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <aside className="order-1 lg:order-2">
              <div className="space-y-4">
                <div className={rightCard}>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Processing Information</h3>
                  <p className="text-sm text-gray-600 leading-6 mb-1">Processing Time: 2–3 Working Days</p>
                  <p className="text-sm text-gray-600 leading-6 mb-1">Requests are processed during office hours only.</p>
                  <p className="text-sm text-gray-600 leading-6">Approved certificates can be downloaded from Request History.</p>
                </div>


                <div className={rightCard}>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">For Assistance</h3>
                  <p className="text-sm text-gray-600 leading-6 mb-1">Examination Section Office</p>
                  <p className="text-sm text-gray-600 leading-6 mb-1">Office Hours: 10:00 AM – 4:00 PM</p>
                  <p className="text-sm text-gray-600 leading-6">Keep Request ID while visiting.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

