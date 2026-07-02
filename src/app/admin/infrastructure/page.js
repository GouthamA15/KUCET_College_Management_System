'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BackupManager from '@/components/admin/infrastructure/BackupManager';
import StorageExplorer from '@/components/admin/infrastructure/StorageExplorer';
import ConfigManager from '@/components/admin/infrastructure/ConfigManager';

function InfrastructureContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'config';

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-20">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-10">
        
        {/* Header Section */}
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight break-words leading-tight">System Infrastructure</h1>
          <p className="text-sm text-slate-500 mt-1 sm:mt-2 font-medium leading-snug">Critical system maintenance, data sovereignty, and storage management.</p>
        </div>

        {/* Tabs are now managed via the sidebar navigation */}


        {/* Tab Content */}
        <div className="animate-fadeIn mt-6">
          {activeTab === 'config' && <ConfigManager />}
          {activeTab === 'backups' && <BackupManager />}
          {activeTab === 'storage' && <StorageExplorer />}
        </div>
      </div>
    </div>
  );
}

export default function InfrastructurePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>}>
      <InfrastructureContent />
    </Suspense>
  );
}
