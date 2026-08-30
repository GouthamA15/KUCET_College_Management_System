import React from 'react';
import OfflineClient from './OfflineClient';

export const metadata = {
  title: 'Connection Status | KUCET CMS',
  description: 'Offline and Connection Status page for KUCET College Management System',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <OfflineClient />
    </div>
  );
}
