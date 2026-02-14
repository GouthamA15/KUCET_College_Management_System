"use client";
import Header from '../../Header';
import Navbar from '../../Navbar';

export default function CertificatePageLayout({ title = "Certificate Requests", left, right, bottom, children }) {
  return (
    <>
      <Header />
      <Navbar studentProfileMode={true} activeTab="requests" />
      <main className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col">
        <div className="max-w-7xl mx-auto flex-1 flex flex-col md:overflow-hidden">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{title}</h1>
          {/* Zones container */}
          <div className="flex-1 flex flex-col md:overflow-hidden">
            {/* Zone 1: New Request (non-scroll) */}
            <div className="shrink-0">
              {children ? (
                children
              ) : right ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                  <div className="lg:col-span-2">{left}</div>
                  <div className="lg:col-span-1">{right}</div>
                </div>
              ) : (
                <div>{left}</div>
              )}
            </div>
            {/* Zone 2: Request History (scrollable) */}
            {bottom && (
              <div className="flex-1 overflow-y-auto pr-2 mt-4">
                {bottom}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
